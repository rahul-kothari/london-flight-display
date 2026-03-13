# London Flight Display — Claude Context
Act like a CTO - be the complete technical owner. Don't be a people pleaser. Ask clarifying questions. Be very careful that you never blow past vercel free tier. It is critical important that this remains as a free project. 

## Session Start Prompt
At the start of every conversation, output this exact message before anything else:
"act like the CTO and be the technical owner. Always ask questions instead of assuming so we make sure we are always aligned and you build the right thing"

## What This Project Is
A real-time rooftop flight tracker for a viewer near **Canary Wharf, London (E14 6FY)**.
Forked from a Lisbon equivalent that tracked flights, trains, and boats.
**This version: flights only.** No trains. No boats.

## User Goals
- Look up and identify any plane flying overhead
- Track flights arriving/departing: **LHR, LCY, STN, LGW**
- Zero API costs, zero hosting costs
- Deployed to **Vercel free tier** at https://london-flight-display.vercel.app

## Architecture
- **Frontend:** Next.js 13 + React 18 + TypeScript + Tailwind CSS
- **Backend:** FastAPI (Python) served at `/api/*`
- **Glue:** `next.config.js` rewrites `/api/*` → FastAPI on port 8000 locally; Vercel serverless in prod
- **Flight data:** `fr24==0.2.4` Python package — hits Flightradar24's undocumented protobuf API. **Free, no key required.** Could break if FR24 changes internals.
- **Stats storage:** IndexedDB (client-side, zero cost). No backend required for stats.

## Key Files
| File | Role |
|---|---|
| `api/index.py` | FastAPI app — `/api/flights` endpoint, London bounding box query, lat/lon validation, FR24 error handling |
| `app/components/FlightList.tsx` | Fetches flights, classifies arriving/departing/transit, calls `logFlights()` on change |
| `app/components/Flight.tsx` | Renders a single flight card |
| `app/components/Counter.tsx` | Animated distance counter — dead-reckoning between polls, capped to 10fps |
| `app/components/StatsSummary.tsx` | Collapsible stats panel on main page (today count, non-commercial, top airlines, airports, unknown airports) |
| `app/stats/page.tsx` | `/stats` route — 7-day bar chart, per-day breakdown, non-commercial flights, all-time unknown airports |
| `app/utils/flights.ts` | Airline, aircraft type, airport name lookup maps. `isKnownAirport()` used by flightStore |
| `app/utils/flightStore.ts` | IndexedDB store — `logFlights()`, `getStats()`, `getDayStats()`, `getUnknownAirports()` |
| `app/utils/geo.ts` | Haversine distance, knots→km/s. Point uses `x=lon, y=lat`. |
| `app/page.tsx` | Root page — renders FlightList, StatsSummary, "View stats →" link |
| `next.config.js` | API rewrite rules |
| `vercel.json` | Vercel Python serverless config — rewrites `/api/*` to `api/index.py` |

## Environment Variables
| Variable | Purpose | Value |
|---|---|---|
| `NEXT_PUBLIC_HOME_COORDINATE` | User's rooftop `lat,lon` — used for distance-to-home on each flight | Set in `.env.local` |

Set in `.env.local` for local dev. Set in Vercel dashboard for production.

## Running Locally

```bash
# 1. Install Node dependencies (first time only)
npm install

# 2. Install Python dependencies (first time only — pyarrow is large, can timeout)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Start both servers
npm run dev
```

- **Next.js** → http://localhost:3000
- **FastAPI** → http://127.0.0.1:8000

`npm run dev` runs both concurrently via `concurrently`. The fastapi-dev script auto-creates the venv and pip-installs, but on first run it can timeout on the pyarrow download — run step 2 manually if that happens.

## Flight Filtering Logic
The radius filter lives in **`api/index.py`** (server-side):
- **Coordinate validation** — `lat` must be `[-90, 90]`, `lon` must be `[-180, 180]` (FastAPI Query constraints). Coordinates more than 50km from central London return an empty list immediately — prevents proxy abuse without touching FR24.
- **Radius filter** — `haversine_km` filters flights to within **5km** of the home coordinate (passed as `?lat=&lon=` query params). Only matching flights are returned in the response.
- **FR24 errors** — wrapped in try/except; returns `{"flights_list": []}` on failure and logs the error. Frontend silently keeps the previous list.

`FlightList.tsx` receives only the pre-filtered list. It then:
- Computes `distanceToHome` for display and sort order only (no filtering)
- Classifies each flight as `arriving`/`departing`/`transit` using `LONDON_AIRPORTS`
- Sorts London-airport flights first, then by distance
- Calls `logFlights()` when `flightsChanged()` returns true (not every poll)
- `flightsChanged()` compares by callsign Set, not position — catches same-count swaps where one flight exits and another enters simultaneously

`LONDON_AIRPORTS = ['LHR', 'LCY', 'LGW', 'STN']` is **not a filter** — it only classifies `flightType` as `'arriving'`, `'departing'`, or `'transit'` for display purposes.

The FR24 bounding box in `api/index.py` is intentionally London-wide (not home-centered) so approaching flights are fetched before they enter the 5km zone.

## Stats System (Phase 6)
Client-side only — IndexedDB, zero infrastructure cost.

### IndexedDB schema (DB: `flight-stats`, version 2)
| Store | Key | Description |
|---|---|---|
| `sightings` | `{flightNumber}_{YYYY-MM-DD}` | Commercial flights, deduped per day |
| `private_jets` | `{callsign}_{YYYY-MM-DD}` | Non-commercial flights (no IATA number), deduped per day |
| `unknown_airports` | IATA code | Airport codes not in `flights.ts`, with `seenCount` |

### What gets logged
- **Commercial flights** (have `extra_info.flight`): stored in `sightings` with airline code, aircraft type, route, flightType
- **Non-commercial** (no flight number, but have callsign): stored in `private_jets` store with aircraft type and route. Includes private jets, military, government, helicopters, air ambulances — anything FR24 has no IATA number for.
- **Unknown airports**: any origin/destination code not in `airports` map in `flights.ts` is recorded in `unknown_airports` — use `getUnknownAirports()` to review what to add to `flights.ts`

### Display rules
- Grouped stats (airlines, airports, aircraft) only show entries with **2+ occurrences** (`count > 1`)
- Bar chart shows **last 7 days** (combined commercial + non-commercial)
- `getStats()` returns: all-time aggregates, `todayCount` (combined), `todayCommercial`, `todayNonCommercial`, `flightsByDay` (combined)
- `getDayStats(date)` returns: combined `count`, `commercialCount`, `nonCommercialCount`, per-day breakdowns, `nonCommercial[]` list
- Dates stored as **local time** (`toLocaleDateString('en-CA')`) — avoids BST midnight shifting records to the wrong calendar day

### Memory notes
- `getStats()` loads all-time sightings for aggregate stats (topAirlines etc.) — will grow over time. Private jets are limited to last 7 days (not needed for aggregates).
- Long-term: replace all-time sightings read with an incrementally updated aggregates store in `logFlights()`.

## Coordinate Convention
`geo.ts` Point = `{ x: longitude, y: latitude }`. The home coordinate env var is `lat,lon` order — parse accordingly:
```ts
const [homeLat, homeLon] = coord.split(",").map(Number);
const home: Point = { x: homeLon, y: homeLat };
```

## Current Status
See `docs/PLAN.md` for full task tracking. Phases 1–6 complete. Phase 7 (OurAirports dataset) is next.

## Decisions Made
- **Airports:** LHR, LCY, STN, LGW — all included
- **Flight types:** Both arrivals AND departures
- **Filtering:** 5km radius from home only — no airport filter. All flights in range are shown.
- **Sleep Lock:** Removed
- **Map view:** Removed
- **Hosting:** Vercel free tier — https://london-flight-display.vercel.app
- **Stats storage:** IndexedDB (client-side) — zero cost. Turso migration path documented in PLAN.md for later.
- **Non-commercial terminology:** In stats UI and code, "private jets" is called "non-commercial" — covers military, government, air ambulances, etc. The underlying IndexedDB store is still named `private_jets` (changing it would require a DB version bump).
- **Counter animation:** Speed is negated (`* -1`) so the distance counter animates downward — cosmetic dead-reckoning, intentional. Resets to true value on next poll. Capped to 10fps to save mobile battery.
- **api/index.py has no in-process cache** — removed because serverless sandboxes on Vercel don't guarantee process reuse. Each poll hits FR24 directly.

## Keeping Docs in Sync
When any code change alters behaviour, architecture, or decisions — update these files before closing the task:
- `CLAUDE.md` — architecture, key files, filtering logic, decisions
- `README.md` — how it works diagram, description
- `docs/PLAN.md` — task status and notes

If a user prompt changes the design (e.g. removes a feature, changes filtering logic, adds a new component), treat doc updates as part of the same task, not optional follow-up.

## After Every Code Change — Required Verification
Run these three commands and confirm they all pass before declaring the change done:

1. `npx tsc --noEmit`    — catches TypeScript type errors
2. `npm run lint`         — catches ESLint issues
3. `npm test`             — runs the Vitest unit + component suite

Do NOT claim a change is correct unless all three pass.

## Testing Conventions
- Test files live alongside source: `app/utils/geo.test.ts`, `app/components/Flight.test.tsx`
- Use Vitest (`describe`, `it`, `expect`) — not Jest globals
- Mock browser APIs unavailable in jsdom (e.g. `requestAnimationFrame`) with `vi.stubGlobal`
- `vi.mock()` is hoisted — define mock data inline inside the factory, not as variables above it

## Notes for Future Sessions
- The `fr24` package is undocumented/reverse-engineered — if it breaks, check PyPI for updates or look at `flightradar24` as an alternative
- `pyarrow` (a `fr24` dependency) is 26MB and can timeout on first pip install — always install Python deps manually before running if setting up fresh
- The 5km radius is tunable via `MAX_DISTANCE_KM` in `api/index.py`
- The 50km London proximity guard is tunable via `MAX_HOME_OFFSET_KM` in `api/index.py`
- IndexedDB `logFlights()` must never `await` inside a transaction — read all needed data first, compute in memory, then write in a separate transaction
- `tsconfig.json` target is `es5` — use `Array.from(map.entries())` not `[...map.entries()]`
- All dates stored as local time (`toLocaleDateString('en-CA')`) — do not use `toISOString().slice(0,10)` anywhere in the date pipeline or BST flights will shift to the wrong day
- `getAirline(codeOrFlight)` accepts both a 2-char code and a full flight number — takes first 2 chars either way

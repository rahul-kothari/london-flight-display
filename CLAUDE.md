# London Flight Display — Claude Context
Act like a CTO - be the complete technical owner. Don't be a people pleaser. Ask clarifying questions.

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
- Local for now, then deploy to **Vercel free tier**

## Architecture
- **Frontend:** Next.js 13 + React 18 + TypeScript + Tailwind CSS
- **Backend:** FastAPI (Python) served at `/api/*`
- **Glue:** `next.config.js` rewrites `/api/*` → FastAPI on port 8000 locally; Vercel serverless in prod
- **Flight data:** `fr24==0.2.4` Python package — hits Flightradar24's undocumented protobuf API. **Free, no key required.** Could break if FR24 changes internals.

## Key Files
| File | Role |
|---|---|
| `api/index.py` | FastAPI app — `/api/flights` endpoint, London bounding box query |
| `app/components/FlightList.tsx` | Fetches flights, filters to 5km radius from home, classifies arriving/departing/transit, sorts by distance |
| `app/components/Flight.tsx` | Renders a single flight card |
| `app/utils/flights.ts` | Airline, aircraft type, airport name lookup maps |
| `app/utils/geo.ts` | Haversine distance, knots→km/s. Point uses `x=lon, y=lat`. |
| `app/page.tsx` | Root page, renders FlightList |
| `next.config.js` | API rewrite rules |
| `vercel.json` | Vercel Python serverless config |

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
Single filter in `FlightList.tsx`:
- **Radius filter** — flight's current position must be within **5km** of `NEXT_PUBLIC_HOME_COORDINATE`. All flights in range are shown regardless of route.

`LONDON_AIRPORTS = ['LHR', 'LCY', 'LGW', 'STN']` is **not a filter** — it only classifies `flightType` as `'arriving'`, `'departing'`, or `'transit'` for display purposes.

The FR24 bounding box in `api/index.py` is intentionally London-wide (not home-centered) so approaching flights are fetched before they enter the 5km zone.

## Coordinate Convention
`geo.ts` Point = `{ x: longitude, y: latitude }`. The home coordinate env var is `lat,lon` order — parse accordingly:
```ts
const [homeLat, homeLon] = coord.split(",").map(Number);
const home: Point = { x: homeLon, y: homeLat };
```

## Current Status
See `docs/PLAN.md` for full task tracking. Phases 1–4 complete. Phase 5 (Vercel deployment) in progress. Phase 6 (flight stats) and Phase 7 (OurAirports dataset) are next.

## Decisions Made
- **Airports:** LHR, LCY, STN, LGW — all included
- **Flight types:** Both arrivals AND departures
- **Filtering:** 5km radius from home only — no airport filter. All flights in range are shown.
- **Sleep Lock:** Removed
- **Map view:** Removed
- **Hosting:** Vercel free tier when ready

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

## Notes for Future Sessions
- The `fr24` package is undocumented/reverse-engineered — if it breaks, check PyPI for updates or look at `flightradar24` as an alternative
- `pyarrow` (a `fr24` dependency) is 26MB and can timeout on first pip install — always install Python deps manually before running if setting up fresh
- The 5km radius is tunable via `MAX_DISTANCE_KM` in `FlightList.tsx`

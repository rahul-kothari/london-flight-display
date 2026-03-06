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
- **Frontend:** Next.js 13 + React 18 + TypeScript + Tailwind CSS (static export)
- **Backend:** Cloudflare Pages Function (TypeScript) at `functions/api/flights.ts`
- **Glue:** Cloudflare Pages serves the static Next.js export and `/api/*` functions automatically. No rewrites needed.
- **Flight data:** FR24 JSON endpoint (undocumented) — plain `fetch()` with User-Agent header. Free, no key required. Could break if FR24 changes internals or blocks Cloudflare datacenter IPs.

## Key Files
| File | Role |
|---|---|
| `functions/api/flights.ts` | Cloudflare Pages Function — fetches FR24 JSON, filters to 5km, caches 10s via Cache API |
| `functions/lib/parseFlight.ts` | Maps FR24 positional array → flight object |
| `functions/lib/geo.ts` | Haversine function for the Worker |
| `functions/lib/filter.ts` | Applies radius filter to parsed flight list |
| `app/components/FlightList.tsx` | Fetches flights, classifies arriving/departing/transit, sorts by distance |
| `app/components/Flight.tsx` | Renders a single flight card |
| `app/utils/flights.ts` | Airline, aircraft type, airport name lookup maps |
| `app/utils/geo.ts` | Haversine distance, knots→km/s. Point uses `x=lon, y=lat`. |
| `app/page.tsx` | Root page, renders FlightList |
| `wrangler.toml` | Cloudflare Pages configuration |

## Environment Variables
| Variable | Purpose | Value |
|---|---|---|
| `NEXT_PUBLIC_HOME_COORDINATE` | User's rooftop `lat,lon` — used for distance-to-home on each flight | Set in `.env.local` |

Set in `.env.local` for local dev. Set in Vercel dashboard for production.

## Running Locally

```bash
# 1. Install dependencies (first time only)
npm install

# 2a. Frontend-only dev (fast, hot reload — /api/flights gracefully shows "No flights overhead")
npm run dev        # → http://localhost:3000

# 2b. Full-stack preview (builds static export + runs Pages Function via wrangler)
npm run preview    # → http://localhost:8788
```

Use `npm run dev` for UI development. Use `npm run preview` when you need to test the actual `/api/flights` function locally.

## Flight Filtering Logic
The radius filter lives in **`api/index.py`** (server-side):
- **Radius filter** — `haversine_km` filters flights to within **5km** of the home coordinate (passed as `?lat=&lon=` query params). Only matching flights are returned in the response.

`FlightList.tsx` receives only the pre-filtered list. It then:
- Computes `distanceToHome` for display and sort order only (no filtering)
- Classifies each flight as `arriving`/`departing`/`transit` using `LONDON_AIRPORTS`
- Sorts London-airport flights first, then by distance

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
- **Hosting:** Cloudflare Pages (free tier)

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
- The FR24 JSON endpoint is undocumented. If it stops returning data after deployment, check if Cloudflare's datacenter IPs are being blocked — test the URL from a residential IP first.
- Cold start is ~0ms (V8 isolates). No timeout risk.
- The Cloudflare Cache API stores the raw FR24 bounding box response for 10s, shared across all Worker instances. The haversine filter runs per-request against the cached data.
- The 5km radius is tunable via `MAX_DISTANCE_KM` in `functions/api/flights.ts`

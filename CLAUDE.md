# London Flight Display — Claude Context

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
- **Flight data:** `fr24==0.1.2` Python package — hits Flightradar24's undocumented protobuf API. **Free, no key required.** Could break if FR24 changes internals.
- **Maps:** Leaflet + OpenStreetMap tiles (free)

## Key Files
| File | Role |
|---|---|
| `api/index.py` | FastAPI app — `/api/flights` endpoint, bounding box query |
| `app/components/FlightList.tsx` | Fetches flights, filters by airport + approach zone, sorts by distance |
| `app/components/Flight.tsx` | Renders a single flight card |
| `app/components/Settings.tsx` | Sleep Lock toggle (keeps screen awake) |
| `app/utils/flights.ts` | Airline, aircraft type, airport name lookup maps |
| `app/utils/geo.ts` | Haversine distance, point-in-quadrilateral, knots→km/s |
| `app/utils/time.ts` | Time formatting helpers |
| `app/page.tsx` | Root page, composes FlightList + Settings |
| `next.config.js` | API rewrite rules |
| `vercel.json` | Vercel Python serverless config |

## Environment Variables
| Variable | Purpose | Value |
|---|---|---|
| `NEXT_PUBLIC_HOME_COORDINATE` | User's rooftop lat,lon — used for distance-to-home on each flight | TBD — user (E14 6FY) will provide exact GPS coords |

Set in `.env.local` for local dev. Set in Vercel dashboard for production.

## Running Locally
```bash
npm install
npm run dev          # starts Next.js (port 3000) + FastAPI (port 8000) concurrently
```
FastAPI script in `package.json` creates a venv, installs `requirements.txt`, then runs uvicorn.

## Current Status
See `docs/PLAN.md` for the full implementation plan and task status.

**Short version:** The repo still contains the Lisbon version. No London changes have been made yet.
All implementation tasks are documented and waiting to be picked up.

## What Was Deleted vs What's Left From Lisbon
Nothing deleted yet — all deletions are tracked in `docs/PLAN.md` Phase 1.
Files to remove: `TrainList.tsx`, `Train.tsx`, `BoatList.tsx`, `BoatMap.tsx`, `Boat.tsx`,
`app/utils/trains.ts`, `app/utils/boats.ts`, `api/infra_portugal.py`, `api/aisstream_tracker.py`.

## Approach Zones (London)
Flight filtering uses point-in-quadrilateral checks. London zones are defined in `FlightList.tsx`.
See `docs/EDD.md` for the coordinate design and tuning notes.
These will need real-world testing and iteration — start with generous bounds.

## Decisions Made
- **Airports:** LHR, LCY, STN, LGW — all included, even if STN/LGW are rarely visible from E14
- **Flight types:** Both arrivals AND departures
- **Sleep Lock:** Keep the toggle (useful for always-on tablet display)
- **Map view:** Keep for MVP, revisit later whether to remove
- **Hosting:** Vercel free tier when ready

## Notes for Future Sessions
- The `fr24` package is undocumented/reverse-engineered — if it breaks, check for newer versions or look at `flightradar24` PyPI alternatives
- The `README.md` is still the original Next.js FastAPI boilerplate — it can be updated or deleted
- User will supply exact GPS coordinates for their rooftop when ready; use E14 6FY centroid `51.5054,-0.0235` as a placeholder in the meantime
- **MVP review checkpoint:** Ask user whether to keep or remove the map view once flights are working

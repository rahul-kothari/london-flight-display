# Implementation Plan: London Flight Display

Status key: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 1: Clean Up (Remove Lisbon-Specific Code)

- [x] **1.1** Delete `app/components/TrainList.tsx`
- [x] **1.2** Delete `app/components/Train.tsx`
- [x] **1.3** Delete `app/components/BoatList.tsx`
- [x] **1.4** Delete `app/components/BoatMap.tsx`
- [x] **1.5** Delete `app/components/Boat.tsx`
- [x] **1.6** Delete `app/utils/trains.ts`
- [x] **1.7** Delete `app/utils/boats.ts`
- [x] **1.8** Delete `api/infra_portugal.py`
- [x] **1.9** Delete `api/aisstream_tracker.py`
- [x] **1.10** Update `api/index.py` — remove boats/trains imports, `/api/trains`, `/api/boats` endpoints, startup/shutdown websocket events
- [x] **1.11** Update `app/components/Settings.tsx` — remove boats/trains toggles, keep Sleep Lock
- [x] **1.12** Update `app/page.tsx` — remove TrainList/BoatList imports and JSX, remove showBoats/showTrains state
- [x] **1.13** Update `requirements.txt` — removed `websockets` (was only used by AIS tracker)

---

## Phase 2: London Configuration

- [x] **2.1** Update `api/index.py` — FR24 bounding box set to London:
  ```python
  north=51.80, west=-0.70, south=51.20, east=0.35
  ```

- [x] **2.2** Update `app/components/FlightList.tsx` — replaced Lisbon polygons with 8 London zones:
  - LHR arrivals, LHR departures
  - LCY arrivals, LCY departures
  - LGW arrivals, LGW departures
  - STN arrivals, STN departures
  - Coordinates sourced from `docs/EDD.md`

- [x] **2.3** Update `app/components/FlightList.tsx` — airport filter changed to `['LHR', 'LCY', 'LGW', 'STN']`

- [x] **2.4** Create `.env.local` with placeholder home coordinate:
  ```
  NEXT_PUBLIC_HOME_COORDINATE=51.5054,-0.0235
  ```
  **TODO:** User to replace with exact rooftop GPS coords (right-click roof in Google Maps → Copy coordinates)

- [x] **2.5** Update page title — `app/layout.tsx` now reads "London Flight Tracker"

---

## Phase 3: Local Testing & Tuning

- [x] **3.1** Run locally (`npm run dev`) and verify flights appear
- [x] **3.2** Verify LHR arrivals show when there's inbound traffic (should be near-constant)
- [x] **3.3** Verify LCY arrivals/departures show (airport is ~1.5 miles away)
- [x] **3.4** Check STN and LGW — assess if they produce useful results or too much noise
- [x] **3.5** Tune approach zone polygons based on what's actually visible from the rooftop
- [x] **3.6** Update home coordinate once user provides exact GPS coords
- [x] **3.7** Check for unknown airline/aircraft codes in the UI; expand `app/utils/flights.ts` mappings as needed

---

## Phase 4: Polish

- [x] **4.1** Update `README.md` — replace boilerplate with actual project description
- [x] **4.2** MVP checkpoint: decide whether to keep or remove the map view — removed in Phase 1 (BoatMap.tsx deleted); leaflet/react-leaflet deps also removed
- [ ] **4.3** Check `fr24` package version — consider upgrading if newer version available on PyPI

---

## Phase 5: Vercel Deployment

- [x] **5.1** Push repo to GitHub (if not already)
- [ ] **5.2** Import project in Vercel dashboard
- [ ] **5.3** Set `NEXT_PUBLIC_HOME_COORDINATE` in Vercel Environment Variables
- [ ] **5.4** Verify production deployment works end-to-end
- [ ] **5.5** Share production URL

---

## Phase 6: Flight Stats (IndexedDB)

Track unique flights seen and display stats. Client-side storage (IndexedDB) — zero infrastructure, zero cost. Turso migration path available for later.

**Architecture:**
```
FlightList.tsx → logFlights() → IndexedDB (dedup by flightNumber + date)
                                    ↓
                        StatsSummary (main page, collapsible)
                        StatsPage (/stats route, detailed)
```

**IndexedDB schema:** `flight-stats` DB, `sightings` store
| Field | Type | Description |
|-------|------|-------------|
| `id` | string (PK) | `{flightNumber}_{YYYY-MM-DD}` (dedup key) |
| `flightNumber` | string | e.g. "BA123" |
| `callsign` | string | e.g. "BAW123" |
| `airline` | string | 2-letter code from flight number |
| `aircraftType` | string | e.g. "A320" |
| `origin` | string | Airport code |
| `destination` | string | Airport code |
| `flightType` | string | "arriving" / "departing" / "transit" |
| `date` | string | "YYYY-MM-DD" (indexed) |
| `firstSeen` | number | Unix timestamp |

**Display rule:** Grouped stats (by airline, airport, aircraft type) only show entries with >2 occurrences.

**Tasks:**
- [ ] **6.1** Create `app/utils/flightStore.ts` — IndexedDB open/upgrade, `logFlights()` (idempotent dedup), `getStats()` (aggregated), `getAllSightings()` (raw). Raw IndexedDB API, no library.
- [ ] **6.2** Hook into `FlightList.tsx` — call `logFlights(filteredFlights)` after filtering in `refreshFlights()`
- [ ] **6.3** Create `app/components/StatsSummary.tsx` — collapsible panel on main page: today's flight count, top 3 airlines, airport split (only entries >2)
- [ ] **6.4** Create `app/stats/page.tsx` — dedicated route with date picker, flights per day (CSS bar chart), tables for airline/airport/aircraft breakdowns (entries >2 only)
- [ ] **6.5** Add `<StatsSummary />` to `app/page.tsx` + link to `/stats`
- [ ] **6.6** Add `fake-indexeddb` dev dep, create `app/utils/flightStore.test.ts` + `app/components/StatsSummary.test.tsx`
- [ ] **6.7** Verify: `npx tsc --noEmit`, `npm run lint`, `npm test` all pass
- [ ] **6.8** Optimise - reduce RAM usage etc.

**Future: Turso migration** (after hosting is live)
1. Create free Turso account + database
2. Install `@libsql/client` (~15KB)
3. Add `POST /api/log-flight` and `GET /api/stats` endpoints
4. Swap `flightStore.ts` from IndexedDB to API fetch calls (same `getStats()` interface — stats components unchanged)
5. Env vars: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` in Vercel
6. Optional: one-time migration script to export IndexedDB → Turso

---

## Phase 7: OurAirports Dataset (Issue #1)

Replace the hardcoded ~100-airport map in `app/utils/flights.ts` with the full OurAirports dataset (~9k IATA airports). Fixes missing names/flags for intercontinental and smaller European routes.

- [ ] **7.1** Download `https://ourairports.com/data/airports.csv` and filter to rows with a non-empty `iata_code` (~9k rows)
- [ ] **7.2** Write a build script (`scripts/build-airport-data.ts`) that outputs `app/utils/airport-data.json`: `{ [iata]: { name: string, iso_country: string } }`
- [ ] **7.3** Add `countryToFlag()` helper in `flights.ts` that converts ISO 2-letter country code to flag emoji at runtime (no lookup table needed)
- [ ] **7.4** Rewrite `getAirport()` in `flights.ts` to use `airport-data.json` — preserve `useCode: true` for London-area airports (LHR, LCY, LGW, STN, LTN, SEN, FAB, NHT, BQH)
- [ ] **7.5** Delete the hardcoded `airports` map from `flights.ts`
- [ ] **7.6** Update `getAirportName()` and `getAirline()` — verify no regressions
- [ ] **7.7** Evaluate bundle impact: if JSON >300KB uncompressed, consider moving to `getStaticProps` so it stays server-side only
- [ ] **7.8** Update tests in `app/utils/flights.test.ts` to cover the new lookup path and the `countryToFlag` helper

**Trade-offs to decide before starting:**
- Bundle the JSON in the client (simple, works on Vercel Edge) vs. fetch at build time via `getStaticProps` (keeps client bundle smaller)
- Whether to commit `airport-data.json` to the repo or generate it at build time via a `prebuild` script

---

## Notes

- **Approach polygons:** Starting coordinates in EDD are approximate. Expect to iterate on these after Phase 3 testing.
- **STN/LGW visibility:** From E14, these may produce few or no visible flights. Keep in filter for now; remove if they only generate noise after testing.
- **FR24 reliability:** The `fr24` package is undocumented. If it stops working, check PyPI for updates or alternatives.

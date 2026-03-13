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

- [x] **2.2** Update `app/components/FlightList.tsx` — replaced Lisbon polygons with 5km radius filter from home coordinate. `LONDON_AIRPORTS = ['LHR', 'LCY', 'LGW', 'STN']` classifies `flightType` as arriving/departing/transit for display — it is not a filter.

- [x] **2.3** ~~airport filter~~ (no longer a separate stage — see 2.2)

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
- [x] **4.3** Check `fr24` package version — consider upgrading if newer version available on PyPI

---

## Phase 5: Vercel Deployment

- [x] **5.1** Push repo to GitHub (if not already)
- [x] **5.2** Import project in Vercel dashboard
- [x] **5.3** Set `NEXT_PUBLIC_HOME_COORDINATE` in Vercel Environment Variables
- [x] **5.4** Verify production deployment works end-to-end
- [x] **5.5** Share production URL — https://london-flight-display.vercel.app

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
- [ ] **6.1** Create `app/utils/flightStore.ts` — IndexedDB open/upgrade, `logFlights()` (idempotent dedup), `getStats()` (aggregated), `getAllSightings()` (raw), `getUnknownAirports()` (see 6.1a). Raw IndexedDB API, no library.
  - [ ] **6.1a** Track unknown airports: whenever `getAirport()` returns the `Abroad (XYZ)` fallback (i.e. no entry in `flights.ts`), record the raw IATA code in an `unknown_airports` store (key: IATA code, value: `{ code, seenCount, lastSeen }`). Expose via `getUnknownAirports()` returning codes sorted by `seenCount` desc — so we can periodically review and add the most-seen missing codes to `flights.ts`.
- [ ] **6.2** Hook into `FlightList.tsx` — call `logFlights(filteredFlights)` after filtering in `refreshFlights()`
- [ ] **6.3** Create `app/components/StatsSummary.tsx` — collapsible panel on main page: today's flight count, top 3 airlines, airport split (only entries >2)
- [ ] **6.4** Create `app/stats/page.tsx` — dedicated route with date picker, flights per day (CSS bar chart), tables for airline/airport/aircraft breakdowns (entries >2 only)
- [ ] **6.5** Add `<StatsSummary />` to `app/page.tsx` + link to `/stats`
- [ ] **6.6** Add `fake-indexeddb` dev dep, create `app/utils/flightStore.test.ts` + `app/components/StatsSummary.test.tsx`
- [ ] **6.7** Verify: `npx tsc --noEmit`, `npm run lint`, `npm test` all pass
- [ ] **6.8** Optimise - reduce RAM usage etc.
- [ ] **6.9** Smooth UI jerk when flights update — two-part fix:
  - Animate flight cards in/out with opacity + translateY CSS transitions (needs `framer-motion` or manual CSS with a "leaving" state before DOM removal)
  - Prevent StatsSummary from jumping: give FlightList a `min-height` based on expected card count, or make StatsSummary `position: sticky` at the bottom so it doesn't shift with list height changes

**Future: Turso migration** (after hosting is live)
1. Create free Turso account + database
2. Install `@libsql/client` (~15KB)
3. Add `POST /api/log-flight` and `GET /api/stats` endpoints
4. Swap `flightStore.ts` from IndexedDB to API fetch calls (same `getStats()` interface — stats components unchanged)
5. Env vars: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` in Vercel
6. Optional: one-time migration script to export IndexedDB → Turso

---

## Phase 7: Browser Geolocation

Replace the hardcoded `NEXT_PUBLIC_HOME_COORDINATE` env var with the browser's native Geolocation API. The coordinate is held in React state only — never persisted. If the user closes the tab and returns, a fresh geolocation request fires.

**Scope:** any location within the existing London FR24 bounding box (`north=51.80, south=51.20, west=-0.70, east=0.35`). No backend changes required — `api/index.py` already accepts `?lat=&lon=` query params.

**Architecture:**
```
app/page.tsx
  └─ useGeolocation() hook
       ├─ success  → coord state → <FlightList lat lon />
       └─ error    → <LocationPicker onConfirm={setCoord} />
                          (manual lat/lon entry form)
```

**Tasks:**

- [ ] **7.1** Create `app/hooks/useGeolocation.ts`
  - Calls `navigator.geolocation.getCurrentPosition()` on mount (one-shot, not `watchPosition`)
  - Returns `{ state: 'loading' | 'ready' | 'error', lat?: number, lon?: number }`
  - `loading` until the browser responds; `ready` on success; `error` on denial or API unavailable
  - No storage — coordinate lives in hook state only

- [ ] **7.2** Create `app/components/LocationPicker.tsx`
  - Shown only when `state === 'error'`
  - Single text input in `"lat, lon"` format (matches Google Maps "Copy coordinates" output)
  - Validates that both values are numbers and within the London bounding box (lat 51.20–51.80, lon −0.70–0.35); shows inline error if not
  - "Use this location" submit button
  - Small helper text: _"Right-click your location on Google Maps → Copy coordinates"_
  - Calls `onConfirm(lat, lon)` prop on valid submit

- [ ] **7.3** Update `app/page.tsx`
  - Call `useGeolocation()`
  - `loading` → show a centred "Getting your location…" message (no spinner library — plain CSS)
  - `error` → render `<LocationPicker onConfirm={setCoord} />`
  - `ready` / manual coord set → render `<FlightList lat={coord.lat} lon={coord.lon} />`
  - Remove any reads of `NEXT_PUBLIC_HOME_COORDINATE`

- [ ] **7.4** Update `app/components/FlightList.tsx`
  - Replace env var read (`NEXT_PUBLIC_HOME_COORDINATE`) with `lat: number; lon: number` props
  - No other logic changes — filtering and display are unchanged

- [ ] **7.5** Delete `NEXT_PUBLIC_HOME_COORDINATE` from:
  - `.env.local`
  - Vercel dashboard environment variables (manual step — note in task)
  - Any remaining references in code (`grep -r NEXT_PUBLIC_HOME_COORDINATE`)

- [ ] **7.6** Add tests
  - `app/hooks/useGeolocation.test.ts` — mock `navigator.geolocation` with `vi.stubGlobal`; test success, denial, and unavailable (no API) paths
  - `app/components/LocationPicker.test.tsx` — test validation (bad input, out-of-London coords, valid coords trigger `onConfirm`)

- [ ] **7.7** Verify: `npx tsc --noEmit`, `npm run lint`, `npm test` all pass

**Future consideration:**
- If users near the bounding box edges (e.g. Heathrow perimeter, outer M25) report missing inbound traffic, widen the FR24 bounding box in `api/index.py`. The 5km home-radius filter is separate and unaffected.

---

## Notes

- **STN/LGW visibility:** From E14, these may produce few or no visible flights. They still appear if within 5km radius — LONDON_AIRPORTS classification is purely cosmetic.
- **FR24 reliability:** The `fr24` package is undocumented. If it stops working, check PyPI for updates or alternatives.

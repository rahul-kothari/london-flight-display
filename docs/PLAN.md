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
- [ ] **3.4** Check STN and LGW — assess if they produce useful results or too much noise
- [ ] **3.5** Tune approach zone polygons based on what's actually visible from the rooftop
- [x] **3.6** Update home coordinate once user provides exact GPS coords
- [ ] **3.7** Check for unknown airline/aircraft codes in the UI; expand `app/utils/flights.ts` mappings as needed

---

## Phase 4: Polish

- [x] **4.1** Update `README.md` — replace boilerplate with actual project description
- [ ] **4.2** MVP checkpoint: decide whether to keep or remove the map view
- [ ] **4.3** Check `fr24` package version — consider upgrading if newer version available on PyPI

---

## Phase 5: Vercel Deployment

- [x] **5.1** Push repo to GitHub (if not already)
- [ ] **5.2** Import project in Vercel dashboard
- [ ] **5.3** Set `NEXT_PUBLIC_HOME_COORDINATE` in Vercel Environment Variables
- [ ] **5.4** Verify production deployment works end-to-end
- [ ] **5.5** Share production URL

---

## Notes

- **Coordinate placeholder:** `51.5054,-0.0235` is E14 6FY centroid. Replace with exact rooftop GPS before real-world use.
- **Approach polygons:** Starting coordinates in EDD are approximate. Expect to iterate on these after Phase 3 testing.
- **STN/LGW visibility:** From E14, these may produce few or no visible flights. Keep in filter for now; remove if they only generate noise after testing.
- **FR24 reliability:** The `fr24` package is undocumented. If it stops working, check PyPI for updates or alternatives.

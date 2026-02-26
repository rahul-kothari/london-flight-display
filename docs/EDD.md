# Engineering Design Document: London Flight Display

## Problem Statement
A Lisbon-based real-time transport tracker (flights + trains + boats) needs to be adapted for a
rooftop in Canary Wharf, London. The goal is a stripped-down, flights-only display that lets the
user look up at any plane overhead and immediately identify it — airline, flight number, aircraft
type, and distance.

**Constraints:**
- Zero API costs (no paid keys, no paid tiers)
- Zero hosting costs (Vercel free tier for production)
- Local development only initially

---

## Goals
- Show flights arriving and departing from LHR, LCY, STN, LGW that are currently visible from E14 6FY
- Display: flight number, airline, aircraft type, real-time distance countdown, callsign link to Flightradar24
- Both arrivals and departures
- Keep the map view for MVP (re-evaluate post-MVP)
- Keep Sleep Lock toggle (for always-on tablet display)

## Non-Goals
- Trains (removed entirely)
- Boats (removed entirely)
- Any paid API or data subscription
- Tracking flights not plausibly visible from the rooftop (e.g. high-altitude transatlantic overflights)

---

## Data Source: Flightradar24 (FR24)

**Library:** `fr24==0.1.2` (Python)
**How it works:** Queries FR24's internal protobuf LiveFeed API with a bounding box. Returns all
flight positions within that box. No API key required — it uses the same undocumented endpoint
the FR24 website uses.

**Risk:** Undocumented access. FR24 could change their protocol. The `fr24` package may need
updating if it breaks. Acceptable risk given the zero-cost constraint.

**London bounding box** (set in `api/index.py`):
```
north=51.80, south=51.20, west=-0.70, east=0.35
```
This covers all of Greater London, Thames Estuary, and the full approach corridors for all four
airports. Intentionally generous — filtering to visible flights happens in the frontend.

---

## Architecture (Unchanged From Lisbon)

```
Browser
  │
  ├── GET /api/flights  (every 5s)
  │       │
  │       └── FastAPI (api/index.py)
  │               └── fr24 protobuf query → FR24 servers
  │
  └── React (FlightList.tsx)
          ├── Filter by destination airport ∈ {LHR, LCY, STN, LGW}
          ├── Filter by point-in-quadrilateral (approach/departure zone)
          ├── Sort by distance to home
          └── Render Flight cards with live countdown
```

No backend changes beyond bounding box coordinates and removing trains/boats.

---

## Flight Filtering Logic

Each flight returned from FR24 has:
- `lat`, `lon` — current position
- `extraInfo.route.to` — destination IATA code
- `extraInfo.route.from` — origin IATA code
- `speed` — in knots

**Arrival:** `route.to ∈ {LHR, LCY, STN, LGW}` AND position is inside that airport's arrival zone polygon
**Departure:** `route.from ∈ {LHR, LCY, STN, LGW}` AND position is inside that airport's departure zone polygon

---

## Approach Zone Polygons

Polygons are quadrilaterals (4 points: NW, NE, SE, SW) defined as `{x: lon, y: lat}`.
All coordinates are approximate starting points — **real-world testing and tuning is required.**

### LHR Arrivals (Westerly Operations — ~80% of the time)
Aircraft approach from the east flying west along ILS for runway 27L/27R.
Final approach track ≈ 269°. Over E14, altitude ≈ 3,000–5,000 ft.

```
NE: { y: 51.540, x:  0.200 }   — north-east, Thames Estuary
NW: { y: 51.520, x: -0.500 }   — near Heathrow
SW: { y: 51.430, x: -0.500 }   — south of Heathrow
SE: { y: 51.440, x:  0.200 }   — south-east, Thames Estuary
```

### LHR Departures (Easterly — planes climb east after takeoff from 27L/27R)
Less common but aircraft climb east over London.

```
NE: { y: 51.530, x:  0.150 }
NW: { y: 51.530, x: -0.480 }
SW: { y: 51.440, x: -0.480 }
SE: { y: 51.440, x:  0.150 }
```

### LCY Arrivals
City Airport (51.5048°N, 0.0553°E) is ~1.5 miles from E14 6FY. Steep 5.5° glide slope.
Runway 09/27. Tight zone directly around Docklands.

```
NE: { y: 51.530, x:  0.140 }
NW: { y: 51.530, x: -0.060 }
SW: { y: 51.480, x: -0.060 }
SE: { y: 51.480, x:  0.140 }
```

### LCY Departures
Departures from runway 27 head west; from runway 09 head east over Thames Estuary.

```
NE: { y: 51.530, x:  0.200 }
NW: { y: 51.530, x: -0.100 }
SW: { y: 51.470, x: -0.100 }
SE: { y: 51.470, x:  0.200 }
```

### LGW Arrivals (from the north, runway 08R/26L)
Planes approaching LGW from the north pass south of central London. Occasionally visible from E14.

```
NE: { y: 51.500, x:  0.100 }
NW: { y: 51.500, x: -0.250 }
SW: { y: 51.100, x: -0.250 }
SE: { y: 51.100, x:  0.100 }
```

### LGW Departures (heading north)

```
NE: { y: 51.500, x:  0.100 }
NW: { y: 51.500, x: -0.250 }
SW: { y: 51.100, x: -0.250 }
SE: { y: 51.100, x:  0.100 }
```

### STN Arrivals (from the south, runway 22)
Stansted is north-east of London. Southbound arrivals may pass over E14 area.

```
NE: { y: 51.920, x:  0.400 }
NW: { y: 51.920, x: -0.100 }
SW: { y: 51.450, x: -0.100 }
SE: { y: 51.450, x:  0.400 }
```

### STN Departures (heading south)

```
NE: { y: 51.920, x:  0.400 }
NW: { y: 51.920, x: -0.100 }
SW: { y: 51.450, x: -0.100 }
SE: { y: 51.450, x:  0.400 }
```

> **Tuning note:** STN and LGW zones are intentionally large to start. After real-world testing,
> tighten these to reduce noise. LHR and LCY zones are the most important for E14 6FY.

---

## Home Coordinate

Used to compute real-time distance-to-home for each flight (the countdown).
Set via `NEXT_PUBLIC_HOME_COORDINATE` env variable as `"lat,lon"`.

**Placeholder:** `51.5054,-0.0235` (E14 6FY centroid)
**TODO:** User to provide exact rooftop GPS coordinates. Replace placeholder before real-world use.

How to get exact coords: Google Maps → right-click rooftop → "Copy coordinates"

---

## Files Deleted (vs Lisbon Original)

| File | Reason |
|---|---|
| `app/components/TrainList.tsx` | Trains not needed |
| `app/components/Train.tsx` | Trains not needed |
| `app/components/BoatList.tsx` | Boats not needed |
| `app/components/BoatMap.tsx` | Boats not needed |
| `app/components/Boat.tsx` | Boats not needed |
| `app/utils/trains.ts` | Trains not needed |
| `app/utils/boats.ts` | Boats not needed |
| `api/infra_portugal.py` | Portuguese train API |
| `api/aisstream_tracker.py` | AIS boat WebSocket (also had hardcoded API key) |

---

## Files Modified (vs Lisbon Original)

| File | Change |
|---|---|
| `api/index.py` | Remove boats/trains imports and endpoints; update bounding box to London |
| `app/components/FlightList.tsx` | Replace Lisbon polygons with London polygons; update airport filter to LHR/LCY/STN/LGW |
| `app/components/Settings.tsx` | Remove boats/trains toggles; keep Sleep Lock |
| `app/page.tsx` | Remove TrainList/BoatList imports and usage; remove showBoats/showTrains state |
| `app/utils/flights.ts` | Expand airline/aircraft mappings for LHR traffic (iterative) |

---

## Hosting: Vercel Free Tier

The existing `vercel.json` and `next.config.js` are already configured correctly.

**To deploy:**
1. Push repo to GitHub
2. Import project in Vercel dashboard
3. Set `NEXT_PUBLIC_HOME_COORDINATE` in Vercel Environment Variables
4. Done — Vercel auto-deploys on every push to `main`

**Costs:** $0
- Next.js hosting: Vercel Hobby plan (free)
- FastAPI: Vercel Python serverless functions (free within Hobby limits)
- FR24 data: No key, no cost
- Map tiles: OpenStreetMap (free)

---

## Open Questions / Future Decisions

1. **Exact rooftop GPS coordinates** — User to provide; placeholder in place for now
2. **Map view** — Keep for MVP, revisit post-MVP whether it adds value for flights vs boats
3. **Airline mappings** — `app/utils/flights.ts` has ~100 entries focused on European/LIS traffic.
   LHR has a much wider range (Gulf carriers, Asian carriers, American carriers). Expand iteratively
   as unknown callsigns appear.
4. **FR24 library version** — `fr24==0.1.2` may be outdated. Check PyPI before running into issues.

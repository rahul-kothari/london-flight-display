# Design: Remove Airport Filter — Show All Overhead Flights

**Date:** 2026-02-28
**Branch:** `feat/remove-airport-filter`
**Status:** Approved, pending implementation

## Problem

The app currently requires every flight to have a London airport (LHR/LCY/LGW/STN) as either origin or destination. This means transatlantic, domestic UK, cargo, and transit flights passing directly overhead are silently dropped — even if they're within 5km of home. The 5km radius is already doing the real work; the airport filter adds no value and removes flights the user wants to see.

## Design

### Approach: Minimal (Option A)

Remove the hard airport filter. The 5km radius check is the sole inclusion criterion. London-airport flights sort to the top as a soft preference, not a hard gate.

### Flight Classification

Each flight overhead gets classified as one of three types:

| Type | Condition | Icon |
|---|---|---|
| `arriving` | destination is LHR, LCY, LGW, or STN | 🛬 |
| `departing` | origin is LHR, LCY, LGW, or STN (and not also arriving) | 🛫 |
| `transit` | neither endpoint is a London airport | ✈️ |

### Sort Order

1. London-airport flights (arriving + departing) — sorted by distance ascending
2. Transit flights — sorted by distance ascending

### Card Display

- **Arriving/departing:** unchanged — show the non-London endpoint (flag + city name)
- **Transit:** show `🇫🇷 Paris → Amsterdam 🇳🇱` using both `from` and `to` fields

If route data is missing entirely, fall back gracefully: show raw IATA codes (already handled by `getAirport()`).

## Files Changed

| File | Change |
|---|---|
| `app/components/FlightList.tsx` | Remove airport filter; add `flightType` classification; update sort |
| `app/components/Flight.tsx` | Replace `inbound: boolean` prop with `flightType`; update icon + airport column render |

## Files NOT Changed

- `api/index.py` — bounding box already covers all London airspace
- `app/utils/flights.ts` — `getAirport()` already handles unknown IATA codes gracefully
- `app/utils/geo.ts`, `app/page.tsx`, everything else

## Future Revisit

> **TODO:** If the number of simultaneous cards becomes overwhelming at peak times, consider:
> - A `MAX_FLIGHTS` display cap
> - A toggle for "London airports only" vs "all flights"
> - Filtering out flights with no flight number (private/general aviation)


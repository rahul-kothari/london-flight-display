# Design: Cloudflare Pages Migration

**Date:** 2026-03-06
**Branch:** `cloudflare`
**Status:** Approved — pending implementation

---

## Problem

Vercel Python serverless has a cold-start risk (~3–8s) due to pyarrow (26MB). In-memory cache is per-process so it only survives while the Lambda is warm. The 10s Vercel Hobby timeout means a slow FR24 call on a cold start could 504.

## Solution

Replace FastAPI + fr24 + pyarrow (Python) with a Cloudflare Pages Function (TypeScript). Cloudflare uses V8 isolates — zero cold start. Frontend becomes a Next.js static export served by Cloudflare Pages.

---

## Architecture

```
BEFORE                          AFTER
─────────────────────────────────────────────────────
Next.js 13 (SSR)                Next.js 13 (static export)
FastAPI + uvicorn               Cloudflare Pages Function (TypeScript)
fr24 + pyarrow (Python)         fetch() to FR24 JSON endpoint
vercel.json                     wrangler.toml
next.config.js rewrites         removed
api/index.py                    functions/api/flights.ts
requirements.txt                deleted
concurrently (2 processes)      wrangler pages dev (1 command)
```

**What stays identical:** all frontend code, response shape `{ flights_list: [...] }`, 5km haversine filter, 10s cache TTL.

**Local dev:**
```bash
wrangler pages dev --proxy 3000 -- next dev
```

---

## Pages Function Design (`functions/api/flights.ts`)

### FR24 JSON Endpoint

```
https://data-live.flightradar24.com/zones/fcgi/feed.js
  ?bounds=51.80,51.20,-0.70,0.35
  &faa=1&satellite=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=1
```

### FR24 Response Shape

Each flight is keyed by ICAO hex, value is a positional array:

| Index | Field |
|-------|-------|
| 0 | latitude |
| 1 | longitude |
| 2 | heading |
| 3 | altitude (ft) |
| 4 | speed (knots) |
| 5 | squawk |
| 6 | radar id |
| 7 | aircraft type (e.g. "B738") |
| 8 | registration |
| 9 | last contact timestamp |
| 10 | origin IATA |
| 11 | destination IATA |
| 12 | flight number (e.g. "BA123") |
| 13 | on_ground (0/1) |
| 14 | vertical rate |
| 15 | callsign |

### Function Logic

1. Check Cloudflare Cache API — return cached response if within 10s TTL
2. Fetch FR24 JSON endpoint with `User-Agent` header
3. Parse each flight from positional array
4. Haversine filter — keep flights within 5km of `?lat=&lon=`
5. Return `{ flights_list: [...] }` — same shape as Python backend
6. Store result in Cache API with 10s TTL (shared across all instances)

### Caching Improvement

Cloudflare Cache API is shared across all Worker instances in a region. This correctly handles concurrent users, unlike the Python per-process `_cache` dict.

---

## File Structure

```
functions/
  api/
    flights.ts          — Pages Function (fetch, cache, filter, respond)
  lib/
    geo.ts              — haversine (pure, testable)
    parseFlight.ts      — FR24 array → flight object (pure, testable)
    filter.ts           — apply haversine filter to flight list (pure, testable)
```

---

## Testing

Pure functions in `functions/lib/` tested with existing Vitest setup:

- `functions/lib/parseFlight.test.ts` — FR24 array → expected object shape
- `functions/lib/filter.test.ts` — inside/outside 5km, null lat/lon, on-ground edge cases

Worker fetch/cache wiring is not unit tested (thin glue code, requires Wrangler runtime).

All 29 existing frontend tests remain untouched.

---

## Config Changes

| File | Change |
|------|--------|
| `next.config.js` | Add `output: 'export'`, remove rewrites |
| `wrangler.toml` | New — Cloudflare Pages config |
| `package.json` | Replace `fastapi-dev`/`concurrently` with `wrangler pages dev` |
| `vercel.json` | Deleted |
| `api/index.py` | Deleted |
| `requirements.txt` | Deleted |

---

## Known Risk

Cloudflare outbound requests come from datacenter IPs. FR24 may rate-limit or block them. Cannot verify without deploying. If blocked, the branch is abandoned and `main` (Vercel) remains the deployment target.

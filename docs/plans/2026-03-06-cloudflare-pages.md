# Cloudflare Pages Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the FastAPI/Python backend with a Cloudflare Pages Function (TypeScript), and switch Next.js to static export so the whole app deploys on Cloudflare Pages with zero cold start.

**Architecture:** `functions/api/flights.ts` is a Cloudflare Pages Function that fetches FR24's JSON endpoint, filters flights to 5km radius via haversine, and caches the raw FR24 response in the Cloudflare Cache API (shared across instances). Next.js becomes a static export (`output: 'export'`), served by Cloudflare Pages alongside the function.

**Tech Stack:** TypeScript, Cloudflare Pages Functions, Cloudflare Cache API, Vitest (existing), wrangler CLI

---

## Task 1: Create branch and install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Create the cloudflare branch**
```bash
git checkout -b cloudflare
```

**Step 2: Install wrangler and Cloudflare Workers types**
```bash
npm install --save-dev wrangler @cloudflare/workers-types
```

**Step 3: Verify wrangler is available**
```bash
npx wrangler --version
```
Expected: prints a version number like `3.x.x`

**Step 4: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore: install wrangler and cloudflare workers types"
```

---

## Task 2: Add wrangler.toml and update next.config.js

**Files:**
- Create: `wrangler.toml`
- Modify: `next.config.js`

**Step 1: Create `wrangler.toml`**

```toml
name = "london-flight-display"
pages_build_output_dir = "out"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
```

**Step 2: Update `next.config.js` — add static export, remove rewrites**

Replace the entire file with:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
};

module.exports = nextConfig;
```

**Step 3: Verify TypeScript still passes**
```bash
npx tsc --noEmit
```
Expected: no errors

**Step 4: Commit**
```bash
git add wrangler.toml next.config.js
git commit -m "chore: add wrangler.toml, switch next.js to static export"
```

---

## Task 3: functions/lib/geo.ts — haversine (TDD)

**Files:**
- Create: `functions/lib/geo.ts`
- Create: `functions/lib/geo.test.ts`

Pure haversine function for the Worker. Identical logic to `app/utils/geo.ts` but with a flat function signature (lat1, lon1, lat2, lon2) to match how the Worker calls it.

**Step 1: Write the failing test — create `functions/lib/geo.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { haversineKm } from './geo'

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(51.5054, -0.0235, 51.5054, -0.0235)).toBe(0)
  })

  it('calculates distance between LHR and LCY (~35km)', () => {
    const d = haversineKm(51.4775, -0.4543, 51.5048, 0.0553)
    expect(d).toBeGreaterThan(33)
    expect(d).toBeLessThan(38)
  })

  it('returns less than 5 for a point 3km from home', () => {
    // Home: 51.5054, -0.0235 — point ~3km north
    const d = haversineKm(51.5054, -0.0235, 51.5324, -0.0235)
    expect(d).toBeGreaterThan(2)
    expect(d).toBeLessThan(5)
  })

  it('returns more than 5 for a point 10km from home', () => {
    // Home: 51.5054, -0.0235 — point ~10km north
    const d = haversineKm(51.5054, -0.0235, 51.5954, -0.0235)
    expect(d).toBeGreaterThan(5)
  })
})
```

**Step 2: Run — verify it fails**
```bash
npm test -- functions/lib/geo.test.ts
```
Expected: FAIL — `Cannot find module './geo'`

**Step 3: Create `functions/lib/geo.ts`**

```typescript
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

**Step 4: Run — verify it passes**
```bash
npm test -- functions/lib/geo.test.ts
```
Expected: 4 passed

**Step 5: Commit**
```bash
git add functions/lib/geo.ts functions/lib/geo.test.ts
git commit -m "feat: add haversine function for cloudflare worker"
```

---

## Task 4: functions/lib/parseFlight.ts — FR24 array parser (TDD)

**Files:**
- Create: `functions/lib/parseFlight.ts`
- Create: `functions/lib/parseFlight.test.ts`

FR24's JSON endpoint returns each flight as a positional array keyed by ICAO hex:
```
[lat, lon, heading, altitude, speed, squawk, radar, type, reg,
 timestamp, origin_iata, dest_iata, flight_no, on_ground, vspeed, callsign]
  [0]   [1]    [2]       [3]      [4]    [5]     [6]    [7]   [8]
  [9]      [10]         [11]         [12]       [13]     [14]    [15]
```

**Step 1: Write the failing test — create `functions/lib/parseFlight.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { parseFlight } from './parseFlight'

const SAMPLE_ENTRY = [
  51.505, -0.023, 180, 3000, 250, '7654', 'T-MLAT1',
  'B738', 'G-ABCD', 1700000000, 'AMS', 'LHR', 'BA123', 0, -64, 'BAW123'
]

describe('parseFlight', () => {
  it('parses a full FR24 array into a flight object', () => {
    const result = parseFlight('ABC123', SAMPLE_ENTRY)
    expect(result).not.toBeNull()
    expect(result!.callsign).toBe('BAW123')
    expect(result!.lat).toBe(51.505)
    expect(result!.lon).toBe(-0.023)
    expect(result!.speed).toBe(250)
    expect(result!.extra_info.flight).toBe('BA123')
    expect(result!.extra_info.type).toBe('B738')
    expect(result!.extra_info.route).toEqual({ from: 'AMS', to: 'LHR' })
  })

  it('returns null for non-array input', () => {
    expect(parseFlight('ABC123', 'not-an-array' as unknown as unknown[])).toBeNull()
  })

  it('returns null for array too short to contain position data', () => {
    expect(parseFlight('ABC123', [51.505, -0.023])).toBeNull()
  })

  it('returns null when lat/lon are zero (no position fix)', () => {
    const noFix = [...SAMPLE_ENTRY]
    noFix[0] = 0
    noFix[1] = 0
    expect(parseFlight('ABC123', noFix)).toBeNull()
  })

  it('sets route to null when origin or dest is missing', () => {
    const noRoute = [...SAMPLE_ENTRY]
    noRoute[10] = ''
    noRoute[11] = ''
    const result = parseFlight('ABC123', noRoute)
    expect(result!.extra_info.route).toBeNull()
  })

  it('falls back to ICAO hex as callsign when callsign field is empty', () => {
    const noCallsign = [...SAMPLE_ENTRY]
    noCallsign[15] = ''
    const result = parseFlight('ABC123', noCallsign)
    expect(result!.callsign).toBe('ABC123')
  })
})
```

**Step 2: Run — verify it fails**
```bash
npm test -- functions/lib/parseFlight.test.ts
```
Expected: FAIL — `Cannot find module './parseFlight'`

**Step 3: Create `functions/lib/parseFlight.ts`**

```typescript
export interface FlightEntry {
  callsign: string;
  lat: number;
  lon: number;
  speed: number;
  extra_info: {
    flight: string | null;
    type: string | null;
    route: { from: string; to: string } | null;
  };
}

export function parseFlight(icao: string, data: unknown): FlightEntry | null {
  if (!Array.isArray(data) || data.length < 16) return null;
  const lat = data[0] as number;
  const lon = data[1] as number;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (lat === 0 && lon === 0) return null;

  const origin = (data[10] as string) || null;
  const dest = (data[11] as string) || null;

  return {
    callsign: (data[15] as string) || icao,
    lat,
    lon,
    speed: (data[4] as number) || 0,
    extra_info: {
      flight: (data[12] as string) || null,
      type: (data[7] as string) || null,
      route: origin && dest ? { from: origin, to: dest } : null,
    },
  };
}
```

**Step 4: Run — verify it passes**
```bash
npm test -- functions/lib/parseFlight.test.ts
```
Expected: 6 passed

**Step 5: Commit**
```bash
git add functions/lib/parseFlight.ts functions/lib/parseFlight.test.ts
git commit -m "feat: add FR24 array parser for cloudflare worker"
```

---

## Task 5: functions/lib/filter.ts — radius filter (TDD)

**Files:**
- Create: `functions/lib/filter.ts`
- Create: `functions/lib/filter.test.ts`

**Step 1: Write the failing test — create `functions/lib/filter.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { filterByRadius } from './filter'
import { FlightEntry } from './parseFlight'

const HOME_LAT = 51.5054
const HOME_LON = -0.0235

function makeFlight(lat: number, lon: number): FlightEntry {
  return {
    callsign: 'TEST',
    lat,
    lon,
    speed: 200,
    extra_info: { flight: 'TS1', type: 'B738', route: null },
  }
}

describe('filterByRadius', () => {
  it('includes a flight at the home position (0km)', () => {
    const flights = [makeFlight(HOME_LAT, HOME_LON)]
    expect(filterByRadius(flights, HOME_LAT, HOME_LON, 5)).toHaveLength(1)
  })

  it('includes a flight ~2km away', () => {
    // ~2km north of home
    const flights = [makeFlight(51.5234, HOME_LON)]
    expect(filterByRadius(flights, HOME_LAT, HOME_LON, 5)).toHaveLength(1)
  })

  it('excludes a flight ~10km away', () => {
    // ~10km north of home
    const flights = [makeFlight(51.5954, HOME_LON)]
    expect(filterByRadius(flights, HOME_LAT, HOME_LON, 5)).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(filterByRadius([], HOME_LAT, HOME_LON, 5)).toHaveLength(0)
  })

  it('filters correctly when mixing near and far flights', () => {
    const flights = [
      makeFlight(HOME_LAT, HOME_LON),      // 0km — in
      makeFlight(51.5234, HOME_LON),        // ~2km — in
      makeFlight(51.5954, HOME_LON),        // ~10km — out
    ]
    expect(filterByRadius(flights, HOME_LAT, HOME_LON, 5)).toHaveLength(2)
  })
})
```

**Step 2: Run — verify it fails**
```bash
npm test -- functions/lib/filter.test.ts
```
Expected: FAIL — `Cannot find module './filter'`

**Step 3: Create `functions/lib/filter.ts`**

```typescript
import { haversineKm } from './geo';
import { FlightEntry } from './parseFlight';

export function filterByRadius(
  flights: FlightEntry[],
  homeLat: number,
  homeLon: number,
  maxKm: number,
): FlightEntry[] {
  return flights.filter(f => haversineKm(homeLat, homeLon, f.lat, f.lon) <= maxKm);
}
```

**Step 4: Run — verify it passes**
```bash
npm test -- functions/lib/filter.test.ts
```
Expected: 5 passed

**Step 5: Run full test suite — all 29 + new tests must pass**
```bash
npm test
```
Expected: all tests pass

**Step 6: Commit**
```bash
git add functions/lib/filter.ts functions/lib/filter.test.ts
git commit -m "feat: add radius filter for cloudflare worker"
```

---

## Task 6: functions/api/flights.ts — the Pages Function

**Files:**
- Create: `functions/api/flights.ts`

This is the actual Cloudflare Pages Function. It is NOT unit tested (thin glue code using Worker globals). Wrangler handles its TypeScript.

**Step 1: Create `functions/api/flights.ts`**

```typescript
/// <reference types="@cloudflare/workers-types" />
import { parseFlight } from '../lib/parseFlight';
import { filterByRadius } from '../lib/filter';

const FR24_URL =
  'https://data-live.flightradar24.com/zones/fcgi/feed.js' +
  '?bounds=51.80,51.20,-0.70,0.35' +
  '&faa=1&satellite=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=1&estimated=1&maxage=14400&gliders=1&stats=1';

const CACHE_KEY = new Request('https://fr24-london-bbox-cache/v1');
const CACHE_TTL = 10;
const MAX_DISTANCE_KM = 5;

export async function onRequest(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const lat = parseFloat(url.searchParams.get('lat') ?? '');
  const lon = parseFloat(url.searchParams.get('lon') ?? '');

  if (isNaN(lat) || isNaN(lon)) {
    return new Response(JSON.stringify({ error: 'lat and lon query params are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cache = caches.default;
  let raw: Record<string, unknown>;

  const cached = await cache.match(CACHE_KEY);
  if (cached) {
    raw = await cached.json();
  } else {
    const resp = await fetch(FR24_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LondonFlightTracker/1.0)' },
    });
    if (!resp.ok) {
      return new Response(JSON.stringify({ flights_list: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    raw = await resp.json();
    await cache.put(
      CACHE_KEY,
      new Response(JSON.stringify(raw), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${CACHE_TTL}` },
      }),
    );
  }

  const parsed = Object.entries(raw)
    .map(([icao, data]) => parseFlight(icao, data))
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const nearby = filterByRadius(parsed, lat, lon, MAX_DISTANCE_KM);

  return new Response(JSON.stringify({ flights_list: nearby }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
```

**Step 2: Commit**
```bash
git add functions/api/flights.ts
git commit -m "feat: add cloudflare pages function for /api/flights"
```

---

## Task 7: Update package.json scripts

**Files:**
- Modify: `package.json`

Replace the `scripts` section with:

```json
"scripts": {
  "dev": "wrangler pages dev --proxy 3000 -- next dev",
  "build": "next build",
  "preview": "next build && wrangler pages dev ./out",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Removed: `fastapi-dev`, `next-dev`, `start` (no server to start for static export).
Added: `preview` — builds the static site and runs it through wrangler locally (closest to prod).

**Step 1: Apply the change, then verify tests still pass**
```bash
npm test
```
Expected: all tests pass

**Step 2: Commit**
```bash
git add package.json
git commit -m "chore: replace fastapi dev script with wrangler pages dev"
```

---

## Task 8: Delete Python files

**Files:**
- Delete: `api/index.py`
- Delete: `api/__init__.py`
- Delete: `requirements.txt`
- Delete: `vercel.json`

**Step 1: Delete the files**
```bash
git rm api/index.py api/__init__.py requirements.txt vercel.json
```

**Step 2: Verify TypeScript and tests still pass**
```bash
npx tsc --noEmit && npm run lint && npm test
```
Expected: all pass

**Step 3: Commit**
```bash
git commit -m "chore: delete python backend and vercel config"
```

---

## Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Update the following sections to reflect the Cloudflare architecture. Make targeted edits — don't rewrite sections that haven't changed.

**Architecture section** — replace the Backend and Glue rows:
```
- **Backend:** Cloudflare Pages Function (TypeScript) at `functions/api/flights.ts`
- **Glue:** Cloudflare Pages serves both the static Next.js export and the `/api/*` Functions automatically. No rewrites needed.
- **Flight data:** FR24 JSON endpoint (undocumented) — `fetch()` with User-Agent header. Free, no key required.
```

**Key Files table** — replace `api/index.py` row:
```
| `functions/api/flights.ts` | Cloudflare Pages Function — fetches FR24 JSON, filters to 5km, caches 10s |
| `functions/lib/parseFlight.ts` | Maps FR24 positional array → flight object |
| `functions/lib/geo.ts` | Haversine for the Worker (pure function) |
| `functions/lib/filter.ts` | Radius filter (pure function) |
```

**Running Locally section** — replace with:
```bash
# 1. Install dependencies (first time only)
npm install

# 2. Start dev server (Next.js + Cloudflare Pages Function)
npm run dev
```
- **Next.js + Worker** → http://localhost:8788 (wrangler proxies Next.js and intercepts /api/*)

**After Every Code Change** section — remove the Python venv/pip steps, keep the three commands.

**Notes for Future Sessions** — replace fr24/pyarrow note with:
```
- The FR24 JSON endpoint is undocumented. If it stops working, check if Cloudflare's datacenter IPs are being blocked by FR24 — test by hitting the URL from a residential IP first.
- Cold start is ~0ms (V8 isolates). No timeout risk.
```

**Step 1: Make the edits, then commit**
```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for cloudflare pages architecture"
```

---

## Task 10: Final verification

**Step 1: Run all checks**
```bash
npx tsc --noEmit && npm run lint && npm test
```
Expected: TypeScript clean, ESLint 0 warnings, all tests pass.

**Step 2: Check the branch is clean**
```bash
git status
```
Expected: `nothing to commit, working tree clean`

**Step 3: Summarise what changed**
```bash
git log main..cloudflare --oneline
```
Expected: ~8 commits listed.

---

## Known Risk (do not block on this)

Cloudflare outbound requests come from datacenter IPs. FR24 may block them. This cannot be verified without deploying. If the deployed function returns empty `flights_list` consistently, the likely cause is FR24 IP blocking — in which case abandon the branch and stay on `main` (Vercel).

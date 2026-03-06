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
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${CACHE_TTL}`,
        },
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

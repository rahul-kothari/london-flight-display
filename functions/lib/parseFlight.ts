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

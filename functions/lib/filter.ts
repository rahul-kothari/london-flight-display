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

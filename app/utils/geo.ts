export interface Point {
  x: number;
  y: number;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function distanceBetweenPoints(point1: Point, point2: Point): number {
  const R = 6371; // Earth's radius in kilometers

  const lat1 = toRadians(point1.y);
  const lon1 = toRadians(point1.x);
  const lat2 = toRadians(point2.y);
  const lon2 = toRadians(point2.x);

  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;

  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;

  return distance;
}

export function knotsToKmPerSec(knots: number): number {
  const kmPerHour = knots * 1.852; // Convert knots to km/h
  const kmPerSec = kmPerHour / 3600; // Convert km/h to km/s
  return kmPerSec;
}

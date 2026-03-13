"use client"
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Point, distanceBetweenPoints, knotsToKmPerSec } from "../utils/geo";
import { getAirline, getAirport, getPlane } from "../utils/flights";
import { logFlights } from "../utils/flightStore";
import Flight from "./Flight";

const _homeCoord = process.env.NEXT_PUBLIC_HOME_COORDINATE;
const home: Point | null = _homeCoord
  ? { x: +_homeCoord.split(",")[1], y: +_homeCoord.split(",")[0] }
  : null;

const LONDON_AIRPORTS = ['LHR', 'LCY', 'LGW', 'STN'];

interface Flight {
  callsign: string;
  extra_info: {
    flight?: string;
    type: string;
    route: {
      from: string;
      to: string;
    };
  };
  lat: number;
  lon: number;
  speed: number;
  flightType: 'arriving' | 'departing' | 'transit';
  distanceToHome: number;
}

function flightsChanged(prev: Flight[], next: Flight[]): boolean {
  if (prev.length !== next.length) return true;
  // Compare by callsign identity, not position — positional comparison misses
  // the case where one flight exits and another enters with the same total count.
  const prevMap = new Map(prev.map((f) => [f.callsign, f]));
  for (const n of next) {
    const p = prevMap.get(n.callsign);
    if (!p) return true; // new callsign entered the radius
    if (p.flightType !== n.flightType) return true;
    if (Math.abs(p.distanceToHome - n.distanceToHome) > 0.05) return true;
  }
  return false;
}

export default function FlightList() {
  const [liveFlights, setLiveFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const prevFlightsRef = useRef<Flight[]>([]);

  const refreshFlights = useCallback(async () => {
    if (!home) return;
    try {
      const response = await fetch(`/api/flights?lat=${home.y}&lon=${home.x}`);
      if (!response.ok) return;
      const data = await response.json();
      const filteredFlights: Flight[] = (data.flights_list ?? [])
        .map((flight: any) => {
          if (flight.lat == null || flight.lon == null) return null;
          const dest = flight.extra_info?.route?.to;
          const origin = flight.extra_info?.route?.from;
          const location: Point = { x: flight.lon, y: flight.lat };
          const distanceToHome = distanceBetweenPoints(location, home); // display and sort only — backend filters by radius
          const isArriving = LONDON_AIRPORTS.includes(dest);
          const isDeparting = LONDON_AIRPORTS.includes(origin) && !isArriving;
          const flightType: 'arriving' | 'departing' | 'transit' =
            isArriving ? 'arriving' : isDeparting ? 'departing' : 'transit';
          return { ...flight, flightType, distanceToHome };
        })
        .filter((flight: any): flight is Flight => flight !== null)
        .sort((a: Flight, b: Flight) => {
          const aIsLondon = a.flightType !== 'transit' ? 0 : 1;
          const bIsLondon = b.flightType !== 'transit' ? 0 : 1;
          if (aIsLondon !== bIsLondon) return aIsLondon - bIsLondon;
          return a.distanceToHome - b.distanceToHome;
        });
      if (flightsChanged(prevFlightsRef.current, filteredFlights)) {
        prevFlightsRef.current = filteredFlights;
        setLiveFlights(filteredFlights);
        logFlights(
          filteredFlights.map((f) => ({
            callsign: f.callsign,
            flightNumber: f.extra_info.flight ?? undefined,
            aircraftType: f.extra_info.type,
            origin: f.extra_info.route?.from ?? '',
            destination: f.extra_info.route?.to ?? '',
            flightType: f.flightType,
          }))
        ).catch(() => {});
      }
    } catch {
      // API unavailable — keep showing previous flights
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFlights();
    const flightInterval = setInterval(refreshFlights, 5000);
    return () => clearInterval(flightInterval);
  }, [refreshFlights]);

  if (!home) return (
    <div className="p-8 text-red-500">
      Missing NEXT_PUBLIC_HOME_COORDINATE — set this environment variable in your Vercel dashboard.
    </div>
  );

  if (isLoading) return <div className="p-8 text-gray-400">Loading flights…</div>;
  if (liveFlights.length === 0) return <div className="p-8 text-gray-400">No flights overhead right now.</div>;

  return (
    <div>
      {liveFlights.map((flight, index) => (
        <ErrorBoundary key={flight.extra_info.flight ?? flight.callsign ?? `idx-${index}`} fallbackRender={({ error }) => <pre>{error.message}</pre>}>
          <Flight
            airport={getAirport(flight.flightType === 'arriving' ? flight.extra_info.route?.from : flight.extra_info.route?.to)}
            flightType={flight.flightType}
            number={flight.extra_info.flight}
            plane={getPlane(flight.extra_info.type)}
            airline={flight.extra_info.flight ? getAirline(flight.extra_info.flight) : "Private Jet"}
            distance={flight.distanceToHome}
            // Speed is negated so the distance counter animates downward between polls.
            // This is intentional cosmetic dead-reckoning: planes overhead are more
            // often approaching than receding. Not physically precise — resets on next poll.
            speed={knotsToKmPerSec(flight.speed ?? 0) * -1}
            callsign={flight.callsign}
            route={flight.extra_info.route}
          />
        </ErrorBoundary>
      ))}
    </div>
  )
}

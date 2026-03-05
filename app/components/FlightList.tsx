"use client"
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Point, distanceBetweenPoints, knotsToKmPerSec } from "../utils/geo";
import { getAirline, getAirport, getPlane } from "../utils/flights";
import Flight from "./Flight";

if (!process.env.NEXT_PUBLIC_HOME_COORDINATE) {
  throw new Error("Missing NEXT_PUBLIC_HOME_COORDINATE");
}
const [homeLat, homeLon] = process.env.NEXT_PUBLIC_HOME_COORDINATE.split(",").map(Number);
const home: Point = { x: homeLon, y: homeLat };

const LONDON_AIRPORTS = ['LHR', 'LCY', 'LGW', 'STN'];
const MAX_DISTANCE_KM = 5;

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
  for (let i = 0; i < prev.length; i++) {
    const p = prev[i], n = next[i];
    if (p.callsign !== n.callsign || p.flightType !== n.flightType) return true;
    if (Math.abs(p.distanceToHome - n.distanceToHome) > 0.05) return true;
  }
  return false;
}

export default function FlightList() {
  const [liveFlights, setLiveFlights] = useState<Flight[]>([]);
  const prevFlightsRef = useRef<Flight[]>([]);

  const refreshFlights = useCallback(async () => {
    try {
      const response = await fetch("/api/flights");
      if (!response.ok) return;
      const data = await response.json();
      const filteredFlights: Flight[] = (data.flights_list ?? [])
        .map((flight: any) => {
          if (flight.lat == null || flight.lon == null) return null;
          const dest = flight.extra_info?.route?.to;
          const origin = flight.extra_info?.route?.from;
          const location: Point = { x: flight.lon, y: flight.lat };
          const distanceToHome = distanceBetweenPoints(location, home);
          if (distanceToHome > MAX_DISTANCE_KM) return null;
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
      }
    } catch {
      // API unavailable — keep showing previous flights
    }
  }, []);

  useEffect(() => {
    refreshFlights();
    const flightInterval = setInterval(refreshFlights, 5000);
    return () => clearInterval(flightInterval);
  }, []);

  return (
    <div>
      {liveFlights.map((flight) => (
        <ErrorBoundary key={flight.extra_info.flight ?? flight.callsign} fallbackRender={({ error }) => <pre>{error.message}</pre>}>
          <Flight
            airport={getAirport(flight.flightType === 'arriving' ? flight.extra_info.route?.from : flight.extra_info.route?.to)}
            flightType={flight.flightType}
            number={flight.extra_info.flight}
            plane={getPlane(flight.extra_info.type)}
            airline={flight.extra_info.flight ? getAirline(flight.extra_info.flight) : "Private Jet"}
            distance={flight.distanceToHome}
            speed={knotsToKmPerSec(flight.speed) * -1}
            callsign={flight.callsign}
            route={flight.extra_info.route}
          />
        </ErrorBoundary>
      ))}
    </div>
  )
}

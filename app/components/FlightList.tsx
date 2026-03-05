"use client"
import { useEffect, useState } from "react";
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
  extraInfo: {
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

export default function FlightList() {
  const [liveFlights, setLiveFlights] = useState<Flight[]>([]);

  const refreshFlights = async () => {
    const response = await fetch("/api/flights");
    const data = await response.json();
    const filteredFlights = (data.flightsList ?? [])
      .map((flight: any) => {
        if (flight.lat == null || flight.lon == null) return null;
        const dest = flight.extraInfo?.route?.to;
        const origin = flight.extraInfo?.route?.from;
        const location: Point = { x: flight.lon, y: flight.lat };
        const distanceToHome = distanceBetweenPoints(location, home);
        if (distanceToHome > MAX_DISTANCE_KM) return null;
        const isArriving = LONDON_AIRPORTS.includes(dest);
        const isDeparting = LONDON_AIRPORTS.includes(origin) && !isArriving;
        const flightType: 'arriving' | 'departing' | 'transit' =
          isArriving ? 'arriving' : isDeparting ? 'departing' : 'transit';
        return { ...flight, flightType, distanceToHome };
      })
      .filter((flight: any) => flight !== null)
      .sort((a: any, b: any) => {
        const aIsLondon = a.flightType !== 'transit' ? 0 : 1;
        const bIsLondon = b.flightType !== 'transit' ? 0 : 1;
        if (aIsLondon !== bIsLondon) return aIsLondon - bIsLondon;
        return a.distanceToHome - b.distanceToHome;
      });
    setLiveFlights(filteredFlights);
  }

  useEffect(() => {
    refreshFlights();
    const flightInterval = setInterval(refreshFlights, 5000);
    return () => clearInterval(flightInterval);
  }, []);

  return (
    <div>
      {liveFlights.map((flight) => (
        <ErrorBoundary key={flight.extraInfo.flight ?? flight.callsign} fallbackRender={({ error }) => <pre>{error.message}</pre>}>
          <Flight
            airport={getAirport(flight.flightType === 'arriving' ? flight.extraInfo.route.from : flight.extraInfo.route.to)}
            flightType={flight.flightType}
            number={flight.extraInfo.flight}
            plane={getPlane(flight.extraInfo.type)}
            airline={flight.extraInfo.flight ? getAirline(flight.extraInfo.flight) : "Private Jet"}
            distance={flight.distanceToHome}
            speed={knotsToKmPerSec(flight.speed) * -1}
            callsign={flight.callsign}
            route={flight.extraInfo.route}
          />
        </ErrorBoundary>
      ))}
    </div>
  )
}

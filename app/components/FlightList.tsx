"use client"
import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Point, distanceBetweenPoints, isPointInQuadrilateral, knotsToKmPerSec } from "../utils/geo";
import { getAirline, getAirport, getPlane } from "../utils/flights";
import Flight from "./Flight";

if (!process.env.NEXT_PUBLIC_HOME_COORDINATE) {
  throw new Error("Missing NEXT_PUBLIC_HOME_COORDINATE");
}
const [homeX, homeY] = process.env.NEXT_PUBLIC_HOME_COORDINATE.split(",").map(Number);
const home: Point = { x: homeX, y: homeY };

// LHR Arrivals — westerly ops, planes approach from east flying west along ILS 27L/27R
const lhrArrivalArea: Point[] = [
  { x:  0.200, y: 51.540 }, // NE — Thames Estuary
  { x: -0.500, y: 51.520 }, // NW — near Heathrow
  { x: -0.500, y: 51.430 }, // SW — south of Heathrow
  { x:  0.200, y: 51.440 }, // SE — Thames Estuary south
];

// LHR Departures — planes climb east after takeoff from 27L/27R
const lhrDepartureArea: Point[] = [
  { x:  0.150, y: 51.530 }, // NE
  { x: -0.480, y: 51.530 }, // NW
  { x: -0.480, y: 51.440 }, // SW
  { x:  0.150, y: 51.440 }, // SE
];

// LCY Arrivals — steep 5.5° glide slope, tight zone over Docklands
const lcyArrivalArea: Point[] = [
  { x:  0.140, y: 51.530 }, // NE
  { x: -0.060, y: 51.530 }, // NW
  { x: -0.060, y: 51.480 }, // SW
  { x:  0.140, y: 51.480 }, // SE
];

// LCY Departures — rwy 27 heads west, rwy 09 heads east over Thames Estuary
const lcyDepartureArea: Point[] = [
  { x:  0.200, y: 51.530 }, // NE
  { x: -0.100, y: 51.530 }, // NW
  { x: -0.100, y: 51.470 }, // SW
  { x:  0.200, y: 51.470 }, // SE
];

// LGW Arrivals — approach from north, passing south of central London
const lgwArrivalArea: Point[] = [
  { x:  0.100, y: 51.500 }, // NE
  { x: -0.250, y: 51.500 }, // NW
  { x: -0.250, y: 51.100 }, // SW
  { x:  0.100, y: 51.100 }, // SE
];

// LGW Departures — heading north
const lgwDepartureArea: Point[] = [
  { x:  0.100, y: 51.500 }, // NE
  { x: -0.250, y: 51.500 }, // NW
  { x: -0.250, y: 51.100 }, // SW
  { x:  0.100, y: 51.100 }, // SE
];

// STN Arrivals — Stansted NE of London, southbound arrivals may pass over E14
const stnArrivalArea: Point[] = [
  { x:  0.400, y: 51.920 }, // NE
  { x: -0.100, y: 51.920 }, // NW
  { x: -0.100, y: 51.450 }, // SW
  { x:  0.400, y: 51.450 }, // SE
];

// STN Departures — heading south
const stnDepartureArea: Point[] = [
  { x:  0.400, y: 51.920 }, // NE
  { x: -0.100, y: 51.920 }, // NW
  { x: -0.100, y: 51.450 }, // SW
  { x:  0.400, y: 51.450 }, // SE
];

const LONDON_AIRPORTS = ['LHR', 'LCY', 'LGW', 'STN'];

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
  isArriving: boolean;
  isDeparting: boolean;
  distanceToHome: number;
}

function classifyFlight(flight: any): { isArriving: boolean; isDeparting: boolean } {
  const location: Point = { x: flight.lon, y: flight.lat };
  const dest = flight.extraInfo.route?.to;
  const origin = flight.extraInfo.route?.from;

  const isArriving =
    (dest === 'LHR' && isPointInQuadrilateral(location, lhrArrivalArea)) ||
    (dest === 'LCY' && isPointInQuadrilateral(location, lcyArrivalArea)) ||
    (dest === 'LGW' && isPointInQuadrilateral(location, lgwArrivalArea)) ||
    (dest === 'STN' && isPointInQuadrilateral(location, stnArrivalArea));

  const isDeparting =
    (origin === 'LHR' && isPointInQuadrilateral(location, lhrDepartureArea)) ||
    (origin === 'LCY' && isPointInQuadrilateral(location, lcyDepartureArea)) ||
    (origin === 'LGW' && isPointInQuadrilateral(location, lgwDepartureArea)) ||
    (origin === 'STN' && isPointInQuadrilateral(location, stnDepartureArea));

  return { isArriving, isDeparting };
}

export default function FlightList() {
  const [liveFlights, setLiveFlights] = useState<Flight[]>([]);

  const refreshFlights = async () => {
    const response = await fetch("/api/flights");
    const data = await response.json();
    const filteredFlights = data.flightsList
      .map((flight: any) => {
        const dest = flight.extraInfo.route?.to;
        const origin = flight.extraInfo.route?.from;
        if (!LONDON_AIRPORTS.includes(dest) && !LONDON_AIRPORTS.includes(origin)) return null;
        const { isArriving, isDeparting } = classifyFlight(flight);
        const distanceToHome = distanceBetweenPoints({ x: flight.lon, y: flight.lat }, home);
        return { ...flight, isArriving, isDeparting, distanceToHome };
      })
      .filter((flight: any) => flight && (flight.isArriving || flight.isDeparting))
      .sort((a: any, b: any) => a.distanceToHome - b.distanceToHome);
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
        <ErrorBoundary key={flight.extraInfo.flight} fallbackRender={({ error }) => <pre>{error.message}</pre>}>
          <Flight
            airport={getAirport(flight.isArriving ? flight.extraInfo.route.from : flight.extraInfo.route.to)}
            inbound={flight.isArriving}
            number={flight.extraInfo.flight}
            plane={getPlane(flight.extraInfo.type)}
            airline={flight.extraInfo.flight ? getAirline(flight.extraInfo.flight) : "Unknown"}
            distance={flight.distanceToHome}
            speed={knotsToKmPerSec(flight.speed) * -1}
            callsign={flight.callsign}
            data={flight}
          />
        </ErrorBoundary>
      ))}
    </div>
  )
}

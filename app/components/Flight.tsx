import { Airport, getAirport } from "../utils/flights";
import { Counter } from "./Counter";

interface FlightProps {
  airport: Airport;
  flightType: 'arriving' | 'departing' | 'transit';
  number?: string;
  plane: string;
  airline: string;
  distance: number;
  speed: number;
  callsign: string;
  route?: { from: string; to: string };
}

export default function Flight({ airport, flightType, number, plane, airline, distance, speed, callsign, route }: FlightProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-[80px_100px_2fr_1fr_190px] bg-gray-800 text-white p-4 rounded-lg shadow-lg gap-4 md:gap-0 m-4">
      <div className="text-6xl md:row-span-2 flex items-center">
        {flightType === 'arriving' ? '🛬' : flightType === 'departing' ? '🛫' : '✈️'}
      </div>
      <div className="text-2xl font-medium text-center md:row-span-2 flex items-center">{number || '-'}</div>
      <div className="text-3xl col-span-2 md:col-span-1 md:text-5xl font-bold md:row-span-2 flex items-center">
        <a href={`https://www.flightradar24.com/${callsign}`} target="_blank" rel="noreferrer">
          {flightType === 'transit' && route ? (
            <>
              {getAirport(route.from).flag} {getAirport(route.from).name}
              {' → '}
              {getAirport(route.to).name} {getAirport(route.to).flag}
            </>
          ) : (
            <>{airport.flag} {airport.name}</>
          )}
        </a>
      </div>
      <div className="md:text-3xl text-center text-xl">{airline}</div>
      <div className="md:col-start-4 md:row-start-2 md:text-2xl text-center text-xl">{plane}</div>
      <div className="md:col-start-5 md:row-start-1 md:row-span-2 col-span-2 md:col-span-1 text-2xl md:text-4xl font-medium text-right flex justify-end items-center">
        <Counter value={distance} speed={speed} />km
      </div>

    </div>
  );
}

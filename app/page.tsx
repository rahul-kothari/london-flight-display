"use client"
import FlightList from "./components/FlightList";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <FlightList />
    </main>
  );
}

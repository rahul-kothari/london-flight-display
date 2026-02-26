"use client"
import FlightList from "./components/FlightList";
import Settings from "./components/Settings";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col justify-between">
      <FlightList />
      <Settings />
    </main>
  );
}

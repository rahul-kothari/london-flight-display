"use client"
import Link from 'next/link';
import FlightList from "./components/FlightList";
import StatsSummary from "./components/StatsSummary";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <FlightList />
      <StatsSummary />
      <div className="px-4 py-4 text-right">
        <Link href="/stats" className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-base font-medium">
          View stats →
        </Link>
      </div>
    </main>
  );
}

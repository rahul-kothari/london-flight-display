"use client"
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getDayStats, getStats, DayStats, Stats } from '../utils/flightStore';
import { getAirline, getAirportName, getPlane } from '../utils/flights';

function formatDate(d: Date): string {
  // Local time — matches dates stored in IndexedDB (also local time).
  return d.toLocaleDateString('en-CA');
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-gray-500 text-sm mb-2">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between text-sm">
      <span>{label}</span>
      <span className="text-gray-400">{value}</span>
    </div>
  );
}

export default function StatsPage() {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [dayStats, setDayStats] = useState<DayStats | null>(null);
  const [summary, setSummary] = useState<Stats | null>(null);

  useEffect(() => {
    setDayStats(null);
    getDayStats(selectedDate).then(setDayStats).catch(() => {});
  }, [selectedDate]);

  useEffect(() => {
    getStats().then(setSummary).catch(() => {});
  }, []);

  const prevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(formatDate(d));
  };

  const nextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    if (formatDate(d) <= formatDate(new Date())) setSelectedDate(formatDate(d));
  };

  const isToday = selectedDate === formatDate(new Date());

  return (
    <main className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm">
          ← Back
        </Link>
        <h1 className="text-lg font-bold">Flight Stats</h1>
      </div>

      {/* Bar chart — last 7 days */}
      {summary && summary.flightsByDay.some((d) => d.count > 0) && (
        <div className="mb-8">
          <p className="text-gray-500 text-sm mb-3">Last 7 days</p>
          <div className="flex items-end gap-1 h-20">
            {summary.flightsByDay.map(({ date, count }) => {
              const maxCount = Math.max(...summary.flightsByDay.map((d) => d.count), 1);
              const heightPct = count === 0 ? 5 : Math.max(10, (count / maxCount) * 100);
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-1 rounded-t transition-colors ${
                    date === selectedDate ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                  style={{ height: `${heightPct}%` }}
                  title={`${date}: ${count} flights`}
                />
              );
            })}
          </div>
          <div className="flex gap-1 mt-1">
            {summary.flightsByDay.map(({ date }) => (
              <div key={date} className="flex-1 text-center text-gray-600 text-xs">
                {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day navigator */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={prevDay} aria-label="Previous day" className="text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 text-lg">
          ‹
        </button>
        <span className="font-mono text-sm">{selectedDate}</span>
        <button
          onClick={nextDay}
          disabled={isToday}
          aria-label="Next day"
          className="text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 text-lg disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {!dayStats && <p className="text-gray-500 text-sm">Loading…</p>}

      {dayStats && (
        <div className="space-y-6">
          <div className="flex items-baseline gap-4">
            <p className="text-2xl font-bold">
              {dayStats.count}{' '}
              <span className="text-gray-400 text-base font-normal">flights</span>
            </p>
            {dayStats.nonCommercialCount > 0 && (
              <p className="text-gray-400 text-sm">
                {dayStats.nonCommercialCount} non-commercial
              </p>
            )}
          </div>

          {dayStats.count === 0 && dayStats.nonCommercial.length === 0 && (
            <p className="text-gray-500 text-sm">No flights recorded for this day.</p>
          )}

          {dayStats.airlines.length > 0 && (
            <Section title="Airlines (2+ this day)">
              {dayStats.airlines.map(({ code, count }) => (
                <Row key={code} label={getAirline(code)} value={count} />
              ))}
            </Section>
          )}

          {dayStats.airports.length > 0 && (
            <Section title="Airports (2+ this day)">
              {dayStats.airports.map(({ code, count }) => (
                <Row key={code} label={getAirportName(code)} value={count} />
              ))}
            </Section>
          )}

          {dayStats.aircraft.length > 0 && (
            <Section title="Aircraft (2+ this day)">
              {dayStats.aircraft.map(({ code, count }) => (
                <Row key={code} label={getPlane(code)} value={count} />
              ))}
            </Section>
          )}

          {dayStats.nonCommercial.length > 0 && (
            <Section title="Non-commercial">
              {dayStats.nonCommercial.map((pj) => (
                <Row
                  key={pj.id}
                  label={`${pj.callsign}${pj.aircraftType ? ` · ${getPlane(pj.aircraftType)}` : ''}`}
                  value={pj.origin && pj.destination ? `${pj.origin} → ${pj.destination}` : pj.origin || pj.destination || '—'}
                />
              ))}
            </Section>
          )}
        </div>
      )}

      {/* All-time unknown airports */}
      {summary && summary.unknownAirports.length > 0 && (
        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <h2 className="text-gray-500 text-sm mb-2">
            New airports seen{' '}
            <span className="text-white font-bold">{summary.unknownAirports.length}</span>
          </h2>
          {summary.unknownAirports.map(({ code, seenCount }) => (
            <div key={code} className="flex justify-between text-sm">
              <span className="font-mono">{code}</span>
              <span className="text-gray-400">{seenCount}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

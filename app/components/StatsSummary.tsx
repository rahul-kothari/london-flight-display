"use client"
import { useState, useEffect } from 'react';
import { getStats, Stats } from '../utils/flightStore';
import { getAirline, getAirportName } from '../utils/flights';

export default function StatsSummary() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!open) return;
    getStats().then(setStats).catch(() => {});
  }, [open]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 mt-2">
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="stats-panel"
      >
        <span>Flights You Have Seen (counted if tab is open, stored in your browser's 🍪)</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && !stats && (
        <p className="px-4 pb-4 text-gray-400 text-sm">Loading stats…</p>
      )}

      {open && stats && (
        <div id="stats-panel" className="px-4 pb-6 space-y-4 text-sm">
          <div className="flex gap-6">
            <p>
              Today: <span className="font-bold">{stats.todayCount}</span> flights
              {stats.todayNonCommercial > 0 && (
                <span className="text-gray-500 ml-2">
                  (<span className="font-bold">{stats.todayNonCommercial}</span> non-commercial)
                </span>
              )}
            </p>
          </div>

          {stats.topAirlines.length > 0 && (
            <div>
              <p className="text-gray-400 mb-1">Top airlines (all-time)</p>
              {stats.topAirlines.map(({ code, count }) => (
                <div key={code} className="flex justify-between">
                  <span>{getAirline(code)}</span>
                  <span className="text-gray-400">{count}</span>
                </div>
              ))}
            </div>
          )}

          {stats.airportBreakdown.length > 0 && (
            <div>
              <p className="text-gray-400 mb-1">Airports (all-time, 2+)</p>
              {stats.airportBreakdown.slice(0, 10).map(({ code, count }) => (
                <div key={code} className="flex justify-between">
                  <span>{getAirportName(code)}</span>
                  <span className="text-gray-400">{count}</span>
                </div>
              ))}
            </div>
          )}

          {stats.unknownAirports.length > 0 && (
            <div>
              <p className="text-gray-400 mb-1">
                New airports seen{' '}  
                <span className="font-bold">{stats.unknownAirports.length}</span>
                <span> (report these!)</span>
              </p>
              {stats.unknownAirports.map(({ code, seenCount }) => (
                <div key={code} className="flex justify-between">
                  <span className="font-mono">{code}</span>
                  <span className="text-gray-400">{seenCount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

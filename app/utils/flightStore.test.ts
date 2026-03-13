import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { logFlights, getStats, getDayStats, getUnknownAirports, getAllSightings } from './flightStore';

vi.mock('./flights', () => ({
  isKnownAirport: (code: string) =>
    ['LHR', 'LCY', 'LGW', 'STN', 'CDG', 'FRA', 'AMS', 'MUC'].includes(code),
}));

function deleteDB(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('flight-stats');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await deleteDB();
});

const commercial = (overrides: Partial<{
  callsign: string; flightNumber: string; aircraftType: string;
  origin: string; destination: string; flightType: 'arriving' | 'departing' | 'transit';
}> = {}) => ({
  callsign: 'BAW123', flightNumber: 'BA123', aircraftType: 'A320',
  origin: 'LHR', destination: 'CDG', flightType: 'departing' as const,
  ...overrides,
});

const privateJet = (overrides: Partial<{
  callsign: string; aircraftType: string; origin: string; destination: string;
}> = {}) => ({
  callsign: 'G-ABCD', aircraftType: 'GLEX', origin: 'LHR', destination: 'CDG',
  flightType: 'transit' as const,
  ...overrides,
});

describe('logFlights — edge cases', () => {
  it('handles empty flights array without error', async () => {
    await expect(logFlights([])).resolves.toBeUndefined();
    expect(await getAllSightings()).toHaveLength(0);
  });
});

describe('logFlights — commercial', () => {
  it('stores a sighting', async () => {
    await logFlights([commercial()]);
    const all = await getAllSightings();
    expect(all).toHaveLength(1);
    expect(all[0].flightNumber).toBe('BA123');
    expect(all[0].airline).toBe('BA');
  });

  it('deduplicates same flight on the same day', async () => {
    await logFlights([commercial()]);
    await logFlights([commercial()]);
    expect(await getAllSightings()).toHaveLength(1);
  });

  it('stores different flights independently', async () => {
    await logFlights([commercial({ flightNumber: 'BA123' }), commercial({ flightNumber: 'LH456', callsign: 'DLH456' })]);
    expect(await getAllSightings()).toHaveLength(2);
  });

  it('skips flights with no flight number AND no callsign', async () => {
    await logFlights([{ callsign: '', flightNumber: undefined, aircraftType: 'A320', origin: 'LHR', destination: 'CDG', flightType: 'transit' }]);
    expect(await getAllSightings()).toHaveLength(0);
  });
});

describe('logFlights — private jets', () => {
  it('stores a private jet sighting', async () => {
    await logFlights([privateJet()]);
    const stats = await getDayStats(new Date().toLocaleDateString('en-CA'));
    expect(stats.nonCommercial).toHaveLength(1);
    expect(stats.nonCommercial[0].callsign).toBe('G-ABCD');
  });

  it('deduplicates same private jet on the same day', async () => {
    await logFlights([privateJet()]);
    await logFlights([privateJet()]);
    const stats = await getDayStats(new Date().toLocaleDateString('en-CA'));
    expect(stats.nonCommercial).toHaveLength(1);
  });

  it('does not add private jet to sightings store', async () => {
    await logFlights([privateJet()]);
    expect(await getAllSightings()).toHaveLength(0);
  });

  it('tracks today non-commercial count in getStats', async () => {
    await logFlights([privateJet(), privateJet({ callsign: 'N12345' })]);
    const stats = await getStats();
    expect(stats.todayNonCommercial).toBe(2);
  });
});

describe('logFlights — unknown airports', () => {
  it('records unknown airports from commercial flights', async () => {
    await logFlights([commercial({ origin: 'XYZ', destination: 'CDG' })]);
    const unknown = await getUnknownAirports();
    expect(unknown).toHaveLength(1);
    expect(unknown[0].code).toBe('XYZ');
  });

  it('records unknown airports from private jets', async () => {
    await logFlights([privateJet({ origin: 'XYZ', destination: 'CDG' })]);
    const unknown = await getUnknownAirports();
    expect(unknown).toHaveLength(1);
    expect(unknown[0].code).toBe('XYZ');
  });

  it('records both unknown origin and destination', async () => {
    await logFlights([commercial({ origin: 'XYZ', destination: 'ABC' })]);
    const codes = (await getUnknownAirports()).map((u) => u.code).sort();
    expect(codes).toEqual(['ABC', 'XYZ']);
  });

  it('increments seenCount on subsequent calls', async () => {
    await logFlights([commercial({ flightNumber: 'BA001', origin: 'XYZ' })]);
    await logFlights([commercial({ flightNumber: 'BA002', origin: 'XYZ' })]);
    const unknown = await getUnknownAirports();
    expect(unknown[0].seenCount).toBe(2);
  });

  it('does not flag known airports as unknown', async () => {
    await logFlights([commercial({ origin: 'LHR', destination: 'CDG' })]);
    expect(await getUnknownAirports()).toHaveLength(0);
  });

  it('surfaces unknown airports in getStats', async () => {
    await logFlights([commercial({ origin: 'XYZ' })]);
    const stats = await getStats();
    expect(stats.unknownAirports.some((a) => a.code === 'XYZ')).toBe(true);
  });
});

describe('getStats', () => {
  it('counts today flights', async () => {
    await logFlights([commercial({ flightNumber: 'BA001' }), commercial({ flightNumber: 'LH001', callsign: 'DLH001' })]);
    const stats = await getStats();
    expect(stats.todayCount).toBe(2);
  });

  it('returns top 3 airlines sorted by count', async () => {
    await logFlights([
      commercial({ flightNumber: 'BA001' }),
      commercial({ flightNumber: 'BA002' }),
      commercial({ flightNumber: 'LH001', callsign: 'DLH001' }),
    ]);
    const stats = await getStats();
    expect(stats.topAirlines[0]).toEqual({ code: 'BA', count: 2 });
  });

  it('filters airport breakdown to >1 (2+ occurrences)', async () => {
    await logFlights([
      commercial({ flightNumber: 'BA001', origin: 'LHR', destination: 'FRA' }),
      commercial({ flightNumber: 'BA002', origin: 'LHR', destination: 'CDG' }),
    ]);
    const stats = await getStats();
    const codes = stats.airportBreakdown.map((a) => a.code);
    // LHR: 2 → included; FRA: 1, CDG: 1 → excluded
    expect(codes).toContain('LHR');
    expect(codes).not.toContain('FRA');
    expect(codes).not.toContain('CDG');
  });

  it('returns flightsByDay for last 7 days', async () => {
    await logFlights([commercial()]);
    const stats = await getStats();
    expect(stats.flightsByDay).toHaveLength(7);
    const today = new Date().toLocaleDateString('en-CA');
    expect(stats.flightsByDay.find((d) => d.date === today)?.count).toBe(1);
  });

  it('flightsByDay correctly shows counts for a past day', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toLocaleDateString('en-CA');

    // Only fake Date — not timers — so fake-indexeddb async operations still resolve.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(threeDaysAgo);
    await logFlights([commercial({ flightNumber: 'BA999' })]);
    vi.useRealTimers();

    await logFlights([commercial({ flightNumber: 'BA001' }), commercial({ flightNumber: 'BA002' })]);

    const stats = await getStats();
    const todayStr = new Date().toLocaleDateString('en-CA');
    expect(stats.flightsByDay.find((d) => d.date === threeDaysAgoStr)?.count).toBe(1);
    expect(stats.flightsByDay.find((d) => d.date === todayStr)?.count).toBe(2);
  });
});

// Regression tests: guard against counting inflation from repeated polls.
// Each describe block simulates the real usage pattern: logFlights called
// repeatedly with the same (or slightly updated) flight list every 5 seconds.
describe('poll regression — no double-counting', () => {
  const today = new Date().toLocaleDateString('en-CA');

  it('commercial flight polled 10 times counts as 1', async () => {
    for (let i = 0; i < 10; i++) await logFlights([commercial()]);
    expect(await getAllSightings()).toHaveLength(1);
    expect((await getStats()).todayCount).toBe(1);
  });

  it('non-commercial flight polled 10 times counts as 1', async () => {
    for (let i = 0; i < 10; i++) await logFlights([privateJet()]);
    const stats = await getDayStats(today);
    expect(stats.nonCommercial).toHaveLength(1);
    expect((await getStats()).todayNonCommercial).toBe(1);
  });

  it('unknown airport seenCount stays at 1 when same flight is re-polled', async () => {
    for (let i = 0; i < 5; i++) await logFlights([commercial({ origin: 'XYZ' })]);
    const unknown = await getUnknownAirports();
    expect(unknown.find((u) => u.code === 'XYZ')?.seenCount).toBe(1);
  });

  it('unknown airport seenCount increments once per distinct new flight that uses it', async () => {
    await logFlights([commercial({ flightNumber: 'BA001', origin: 'XYZ' })]);
    // Re-poll same flight — should not increment
    await logFlights([commercial({ flightNumber: 'BA001', origin: 'XYZ' })]);
    // New flight with same unknown origin — should increment
    await logFlights([commercial({ flightNumber: 'BA002', origin: 'XYZ' })]);
    const unknown = await getUnknownAirports();
    expect(unknown.find((u) => u.code === 'XYZ')?.seenCount).toBe(2);
  });

  it('mixed poll: commercial + non-commercial repeated — todayCount stays correct', async () => {
    const batch = [commercial(), privateJet()];
    for (let i = 0; i < 5; i++) await logFlights(batch);
    const stats = await getStats();
    expect(stats.todayCommercial).toBe(1);
    expect(stats.todayNonCommercial).toBe(1);
    expect(stats.todayCount).toBe(2);
  });

  it('flightsByDay count includes non-commercial and does not inflate on re-poll', async () => {
    for (let i = 0; i < 3; i++) await logFlights([commercial(), privateJet()]);
    const stats = await getStats();
    const todayEntry = stats.flightsByDay.find((d) => d.date === today);
    expect(todayEntry?.count).toBe(2); // 1 commercial + 1 non-commercial, not 6
  });

  it('getDayStats count includes both commercial and non-commercial', async () => {
    await logFlights([commercial(), privateJet()]);
    const stats = await getDayStats(today);
    expect(stats.count).toBe(2);
    expect(stats.commercialCount).toBe(1);
    expect(stats.nonCommercialCount).toBe(1);
  });
});

describe('getDayStats', () => {
  const today = new Date().toLocaleDateString('en-CA');

  it('returns count for the selected day', async () => {
    await logFlights([commercial()]);
    expect((await getDayStats(today)).count).toBe(1);
  });

  it('returns 0 for a day with no flights', async () => {
    expect((await getDayStats('2000-01-01')).count).toBe(0);
  });

  it('includes non-commercial flights in the day', async () => {
    await logFlights([privateJet()]);
    const stats = await getDayStats(today);
    expect(stats.nonCommercial).toHaveLength(1);
    expect(stats.nonCommercial[0].origin).toBe('LHR');
    expect(stats.nonCommercial[0].destination).toBe('CDG');
  });

  it('filters airline breakdown to >1 this day', async () => {
    await logFlights([
      commercial({ flightNumber: 'BA001' }),
      commercial({ flightNumber: 'BA002' }),
    ]);
    const stats = await getDayStats(today);
    expect(stats.airlines.some((a) => a.code === 'BA')).toBe(true);
  });

  it('excludes airlines with exactly 1 flight from breakdown', async () => {
    await logFlights([commercial({ flightNumber: 'BA001' })]);
    const stats = await getDayStats(today);
    expect(stats.airlines.some((a) => a.code === 'BA')).toBe(false);
  });
});

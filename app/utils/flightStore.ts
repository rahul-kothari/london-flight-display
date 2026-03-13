import { isKnownAirport } from './flights';

const DB_NAME = 'flight-stats';
const DB_VERSION = 2; // v2 adds private_jets store

export interface Sighting {
  id: string;           // "{flightNumber}_{YYYY-MM-DD}" — dedup key
  flightNumber: string;
  callsign: string;
  airline: string;      // 2-letter IATA code
  aircraftType: string;
  origin: string;
  destination: string;
  flightType: 'arriving' | 'departing' | 'transit';
  date: string;         // "YYYY-MM-DD"
  firstSeen: number;    // Unix timestamp
}

export interface PrivateJet {
  id: string;           // "callsign_YYYY-MM-DD" — dedup key
  callsign: string;
  aircraftType: string;
  origin: string;
  destination: string;
  date: string;
  firstSeen: number;
}

export interface UnknownAirport {
  code: string;
  seenCount: number;
  lastSeen: number;
}

export interface FlightToLog {
  callsign: string;
  flightNumber?: string;
  aircraftType: string;
  origin: string;
  destination: string;
  flightType: 'arriving' | 'departing' | 'transit';
}

export interface Stats {
  todayCount: number;          // combined commercial + non-commercial
  todayCommercial: number;
  todayNonCommercial: number;
  topAirlines: { code: string; count: number }[];
  airportBreakdown: { code: string; count: number }[]; // all-time, >1
  aircraftBreakdown: { code: string; count: number }[]; // all-time, >1
  flightsByDay: { date: string; count: number }[];      // last 7 days, combined
  unknownAirports: UnknownAirport[];                    // all-time, sorted by seenCount
}

export interface DayStats {
  count: number;               // combined commercial + non-commercial
  commercialCount: number;
  nonCommercialCount: number;
  airlines: { code: string; count: number }[]; // >1 this day
  airports: { code: string; count: number }[];  // >1 this day
  aircraft: { code: string; count: number }[];  // >1 this day
  nonCommercial: PrivateJet[];                  // all non-commercial flights seen this day
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const upgradeTx = (e.target as IDBOpenDBRequest).transaction!;
      if (!db.objectStoreNames.contains('sightings')) {
        const store = db.createObjectStore('sightings', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      } else {
        // v1→v2 upgrade path: sightings store exists but date index may be missing.
        // Without this, readAll() calls that use the 'date' index throw for existing users.
        const store = upgradeTx.objectStore('sightings');
        if (!store.indexNames.contains('date')) {
          store.createIndex('date', 'date', { unique: false });
        }
      }
      if (!db.objectStoreNames.contains('unknown_airports')) {
        db.createObjectStore('unknown_airports', { keyPath: 'code' });
      }
      if (!db.objectStoreNames.contains('private_jets')) {
        const store = db.createObjectStore('private_jets', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function todayStr(): string {
  // Use local time, not UTC — avoids BST midnight shifting dates by one day.
  return new Date().toLocaleDateString('en-CA');
}

function readAll<T>(db: IDBDatabase, storeName: string, indexName?: string, query?: IDBKeyRange): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const source = indexName
      ? tx.objectStore(storeName).index(indexName)
      : tx.objectStore(storeName);
    const req = query ? source.getAll(query) : source.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function logFlights(flights: FlightToLog[]): Promise<void> {
  if (flights.length === 0) return;

  const today = todayStr();
  const now = Date.now();
  const db = await openDB();

  // Read existing IDs for today (avoids awaiting inside write transactions)
  const [existingSightingIds, existingPJIds, existingUnknown] = await Promise.all([
    readAll<Sighting>(db, 'sightings', 'date', IDBKeyRange.only(today))
      .then((rows) => new Set(rows.map((s) => s.id))),
    readAll<PrivateJet>(db, 'private_jets', 'date', IDBKeyRange.only(today))
      .then((rows) => new Set(rows.map((p) => p.id))),
    readAll<UnknownAirport>(db, 'unknown_airports')
      .then((rows) => new Map(rows.map((r) => [r.code, r]))),
  ]);

  const newSightings: Sighting[] = [];
  const newPrivateJets: PrivateJet[] = [];
  const unknownUpdates = new Map<string, UnknownAirport>(existingUnknown);

  for (const flight of flights) {
    if (flight.flightNumber) {
      const id = `${flight.flightNumber}_${today}`;
      if (!existingSightingIds.has(id)) {
        newSightings.push({
          id,
          flightNumber: flight.flightNumber,
          callsign: flight.callsign,
          airline: flight.flightNumber.length >= 2 ? flight.flightNumber.substring(0, 2) : '',
          aircraftType: flight.aircraftType,
          origin: flight.origin,
          destination: flight.destination,
          flightType: flight.flightType,
          date: today,
          firstSeen: now,
        });
      }
    } else if (flight.callsign) {
      const id = `${flight.callsign}_${today}`;
      if (!existingPJIds.has(id)) {
        newPrivateJets.push({
          id,
          callsign: flight.callsign,
          aircraftType: flight.aircraftType,
          origin: flight.origin,
          destination: flight.destination,
          date: today,
          firstSeen: now,
        });
      }
    }
  }

  // Track unknown airports only for genuinely new entries (prevents inflation
  // from repeated logFlights calls while the same flight is overhead)
  for (const entry of [...newSightings, ...newPrivateJets]) {
    for (const code of [entry.origin, entry.destination]) {
      if (!code || isKnownAirport(code)) continue;
      const prev = unknownUpdates.get(code);
      unknownUpdates.set(code, {
        code,
        seenCount: (prev?.seenCount ?? 0) + 1,
        lastSeen: now,
      });
    }
  }

  if (newSightings.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sightings', 'readwrite');
      for (const s of newSightings) tx.objectStore('sightings').add(s);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  if (newPrivateJets.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('private_jets', 'readwrite');
      for (const p of newPrivateJets) tx.objectStore('private_jets').add(p);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Only write records that are genuinely new or have an incremented seenCount.
  const changedUnknowns = Array.from(unknownUpdates.values()).filter((record) => {
    const existing = existingUnknown.get(record.code);
    return !existing || existing.seenCount !== record.seenCount;
  });
  if (changedUnknowns.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('unknown_airports', 'readwrite');
      const store = tx.objectStore('unknown_airports');
      for (const record of changedUnknowns) store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  db.close();
}

export async function getStats(): Promise<Stats> {
  const db = await openDB();
  const today = todayStr();

  // Private jets: only load last 7 days — not needed for all-time aggregates.
  // Sightings: loaded all-time for topAirlines / airportBreakdown / aircraftBreakdown.
  // TODO: replace sightings all-time read with an incrementally updated aggregates store
  //       once the dataset grows large enough to noticeably slow the stats panel.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA');

  const [allSightings, recentPJs, allUnknown] = await Promise.all([
    readAll<Sighting>(db, 'sightings'),
    readAll<PrivateJet>(db, 'private_jets', 'date', IDBKeyRange.bound(sevenDaysAgoStr, today)),
    readAll<UnknownAirport>(db, 'unknown_airports'),
  ]);
  db.close();

  const todayCommercial = allSightings.filter((s) => s.date === today).length;
  const todayNonCommercial = recentPJs.filter((p) => p.date === today).length;
  const todayCount = todayCommercial + todayNonCommercial;

  const airlineCounts = new Map<string, number>();
  const airportCounts = new Map<string, number>();
  const aircraftCounts = new Map<string, number>();

  for (const s of allSightings) {
    airlineCounts.set(s.airline, (airlineCounts.get(s.airline) ?? 0) + 1);
    if (s.origin) airportCounts.set(s.origin, (airportCounts.get(s.origin) ?? 0) + 1);
    if (s.destination) airportCounts.set(s.destination, (airportCounts.get(s.destination) ?? 0) + 1);
    if (s.aircraftType) aircraftCounts.set(s.aircraftType, (aircraftCounts.get(s.aircraftType) ?? 0) + 1);
  }

  const topAirlines = Array.from(airlineCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, count]) => ({ code, count }));

  const airportBreakdown = Array.from(airportCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));

  const aircraftBreakdown = Array.from(aircraftCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));

  const flightsByDay: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA'); // local time — matches stored dates
    const commercial = allSightings.filter((s) => s.date === dateStr).length;
    const nonCommercial = recentPJs.filter((p) => p.date === dateStr).length;
    flightsByDay.push({ date: dateStr, count: commercial + nonCommercial });
  }

  const unknownAirports = allUnknown.sort((a, b) => b.seenCount - a.seenCount);

  return { todayCount, todayCommercial, todayNonCommercial, topAirlines, airportBreakdown, aircraftBreakdown, flightsByDay, unknownAirports };
}

export async function getDayStats(date: string): Promise<DayStats> {
  const db = await openDB();
  const [sightings, privateJets] = await Promise.all([
    readAll<Sighting>(db, 'sightings', 'date', IDBKeyRange.only(date)),
    readAll<PrivateJet>(db, 'private_jets', 'date', IDBKeyRange.only(date)),
  ]);
  db.close();

  const airlineCounts = new Map<string, number>();
  const airportCounts = new Map<string, number>();
  const aircraftCounts = new Map<string, number>();

  for (const s of sightings) {
    airlineCounts.set(s.airline, (airlineCounts.get(s.airline) ?? 0) + 1);
    if (s.origin) airportCounts.set(s.origin, (airportCounts.get(s.origin) ?? 0) + 1);
    if (s.destination) airportCounts.set(s.destination, (airportCounts.get(s.destination) ?? 0) + 1);
    if (s.aircraftType) aircraftCounts.set(s.aircraftType, (aircraftCounts.get(s.aircraftType) ?? 0) + 1);
  }

  const toRanked = (map: Map<string, number>) =>
    Array.from(map.entries())
      .filter(([, c]) => c > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count }));

  return {
    count: sightings.length + privateJets.length,
    commercialCount: sightings.length,
    nonCommercialCount: privateJets.length,
    airlines: toRanked(airlineCounts),
    airports: toRanked(airportCounts),
    aircraft: toRanked(aircraftCounts),
    nonCommercial: privateJets,
  };
}

export async function getAllSightings(): Promise<Sighting[]> {
  const db = await openDB();
  const all = await readAll<Sighting>(db, 'sightings');
  db.close();
  return all;
}

export async function getUnknownAirports(): Promise<UnknownAirport[]> {
  const db = await openDB();
  const all = await readAll<UnknownAirport>(db, 'unknown_airports');
  db.close();
  return all.sort((a, b) => b.seenCount - a.seenCount);
}

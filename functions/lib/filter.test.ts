import { describe, it, expect } from 'vitest'
import { filterByRadius } from './filter'
import { FlightEntry } from './parseFlight'

const HOME_LAT = 51.5054
const HOME_LON = -0.0235

function makeFlight(lat: number, lon: number): FlightEntry {
  return {
    callsign: 'TEST',
    lat,
    lon,
    speed: 200,
    extra_info: { flight: 'TS1', type: 'B738', route: null },
  }
}

describe('filterByRadius', () => {
  it('includes a flight at the home position (0km)', () => {
    const flights = [makeFlight(HOME_LAT, HOME_LON)]
    expect(filterByRadius(flights, HOME_LAT, HOME_LON, 5)).toHaveLength(1)
  })

  it('includes a flight ~2km away', () => {
    const flights = [makeFlight(51.5234, HOME_LON)]
    expect(filterByRadius(flights, HOME_LAT, HOME_LON, 5)).toHaveLength(1)
  })

  it('excludes a flight ~10km away', () => {
    const flights = [makeFlight(51.5954, HOME_LON)]
    expect(filterByRadius(flights, HOME_LAT, HOME_LON, 5)).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(filterByRadius([], HOME_LAT, HOME_LON, 5)).toHaveLength(0)
  })

  it('filters correctly when mixing near and far flights', () => {
    const flights = [
      makeFlight(HOME_LAT, HOME_LON),   // 0km — in
      makeFlight(51.5234, HOME_LON),    // ~2km — in
      makeFlight(51.5954, HOME_LON),    // ~10km — out
    ]
    expect(filterByRadius(flights, HOME_LAT, HOME_LON, 5)).toHaveLength(2)
  })
})

import { describe, it, expect } from 'vitest'
import { parseFlight } from './parseFlight'

const SAMPLE_ENTRY = [
  51.505, -0.023, 180, 3000, 250, '7654', 'T-MLAT1',
  'B738', 'G-ABCD', 1700000000, 'AMS', 'LHR', 'BA123', 0, -64, 'BAW123'
]

describe('parseFlight', () => {
  it('parses a full FR24 array into a flight object', () => {
    const result = parseFlight('ABC123', SAMPLE_ENTRY)
    expect(result).not.toBeNull()
    expect(result!.callsign).toBe('BAW123')
    expect(result!.lat).toBe(51.505)
    expect(result!.lon).toBe(-0.023)
    expect(result!.speed).toBe(250)
    expect(result!.extra_info.flight).toBe('BA123')
    expect(result!.extra_info.type).toBe('B738')
    expect(result!.extra_info.route).toEqual({ from: 'AMS', to: 'LHR' })
  })

  it('returns null for non-array input', () => {
    expect(parseFlight('ABC123', 'not-an-array')).toBeNull()
  })

  it('returns null for array too short to contain position data', () => {
    expect(parseFlight('ABC123', [51.505, -0.023])).toBeNull()
  })

  it('returns null when lat/lon are zero (no position fix)', () => {
    const noFix = [...SAMPLE_ENTRY]
    noFix[0] = 0
    noFix[1] = 0
    expect(parseFlight('ABC123', noFix)).toBeNull()
  })

  it('sets route to null when origin and dest are missing', () => {
    const noRoute = [...SAMPLE_ENTRY]
    noRoute[10] = ''
    noRoute[11] = ''
    const result = parseFlight('ABC123', noRoute)
    expect(result!.extra_info.route).toBeNull()
  })

  it('falls back to ICAO hex as callsign when callsign field is empty', () => {
    const noCallsign = [...SAMPLE_ENTRY]
    noCallsign[15] = ''
    const result = parseFlight('ABC123', noCallsign)
    expect(result!.callsign).toBe('ABC123')
  })
})

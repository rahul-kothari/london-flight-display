import { describe, it, expect } from 'vitest'
import { getPlane, getAirline, getAirport, getAirportName } from './flights'

describe('getPlane', () => {
  it('returns full name for known aircraft type', () => {
    expect(getPlane('B738')).toBe('Boeing 737-800')
    expect(getPlane('A320')).toBe('Airbus A320')
  })

  it('returns raw code for unknown aircraft type', () => {
    expect(getPlane('UNKN')).toBe('UNKN')
  })
})

describe('getAirline', () => {
  it('returns airline name for known flight prefix', () => {
    expect(getAirline('BA123')).toBe('British Airways')
    expect(getAirline('FR456')).toBe('Ryanair')
    expect(getAirline('U2789')).toBe('easyJet Europe')
  })

  it('returns 2-char prefix for unknown airline', () => {
    expect(getAirline('ZZ999')).toBe('ZZ')
  })

  it('returns ? for empty/undefined flight', () => {
    expect(getAirline('')).toBe('?')
  })
})

describe('getAirport', () => {
  it('returns airport data for known code', () => {
    const result = getAirport('LHR')
    expect(result.name).toBe('London Heathrow')
    expect(result.flag).toBe('🇬🇧')
    expect(result.useCode).toBe(true)
  })

  it('returns Abroad fallback for unknown code', () => {
    const result = getAirport('XYZ')
    expect(result.name).toBe('Abroad (XYZ)')
    expect(result.flag).toBe('🌍')
  })

  it('returns generic Abroad for empty string', () => {
    const result = getAirport('')
    expect(result.name).toBe('Abroad')
    expect(result.flag).toBe('🌍')
  })
})

describe('getAirportName', () => {
  it('returns code for London-area airports (useCode: true)', () => {
    expect(getAirportName('LHR')).toBe('LHR')
    expect(getAirportName('LCY')).toBe('LCY')
    expect(getAirportName('LGW')).toBe('LGW')
    expect(getAirportName('STN')).toBe('STN')
  })

  it('returns full name for non-London airports', () => {
    expect(getAirportName('AMS')).toBe('Amsterdam')
    expect(getAirportName('CDG')).toBe('Paris Charles de Gaulle')
  })

  it('returns Abroad fallback for unknown code', () => {
    expect(getAirportName('XYZ')).toBe('Abroad (XYZ)')
  })
})

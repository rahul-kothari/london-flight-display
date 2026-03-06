import { describe, it, expect } from 'vitest'
import { haversineKm } from './geo'

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(51.5054, -0.0235, 51.5054, -0.0235)).toBe(0)
  })

  it('calculates distance between LHR and LCY (~35km)', () => {
    const d = haversineKm(51.4775, -0.4543, 51.5048, 0.0553)
    expect(d).toBeGreaterThan(33)
    expect(d).toBeLessThan(38)
  })

  it('returns less than 5 for a point ~3km from home', () => {
    // ~3km north of home (51.5054, -0.0235)
    const d = haversineKm(51.5054, -0.0235, 51.5324, -0.0235)
    expect(d).toBeGreaterThan(2)
    expect(d).toBeLessThan(5)
  })

  it('returns more than 5 for a point ~10km from home', () => {
    // ~10km north of home
    const d = haversineKm(51.5054, -0.0235, 51.5954, -0.0235)
    expect(d).toBeGreaterThan(5)
  })
})

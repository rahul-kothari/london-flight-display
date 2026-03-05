import { describe, it, expect } from 'vitest'
import { distanceBetweenPoints, knotsToKmPerSec } from './geo'

describe('distanceBetweenPoints', () => {
  it('returns 0 for the same point', () => {
    const p = { x: -0.1276, y: 51.5074 }
    expect(distanceBetweenPoints(p, p)).toBe(0)
  })

  it('calculates distance between LHR and LCY (~35km)', () => {
    const lhr = { x: -0.4543, y: 51.4775 }
    const lcy = { x: 0.0553, y: 51.5048 }
    const distance = distanceBetweenPoints(lhr, lcy)
    expect(distance).toBeGreaterThan(33)
    expect(distance).toBeLessThan(38)
  })

  it('calculates distance between LHR and STN (~65km)', () => {
    const lhr = { x: -0.4543, y: 51.4775 }
    const stn = { x: 0.2350, y: 51.8850 }
    const distance = distanceBetweenPoints(lhr, stn)
    expect(distance).toBeGreaterThan(60)
    expect(distance).toBeLessThan(70)
  })
})

describe('knotsToKmPerSec', () => {
  it('converts 0 knots to 0 km/s', () => {
    expect(knotsToKmPerSec(0)).toBe(0)
  })

  it('converts 100 knots to ~0.0514 km/s', () => {
    const result = knotsToKmPerSec(100)
    expect(result).toBeCloseTo(0.05144, 4)
  })

  it('converts 450 knots (typical cruise speed) to ~0.2315 km/s', () => {
    const result = knotsToKmPerSec(450)
    expect(result).toBeCloseTo(0.2315, 3)
  })
})

import { describe, it, expect } from 'vitest'
import { formatTime } from './time'

describe('formatTime', () => {
  it('formats midnight as 00:00', () => {
    const d = new Date(2024, 0, 1, 0, 0)
    expect(formatTime(d)).toBe('00:00')
  })

  it('formats 9:05am as 09:05', () => {
    const d = new Date(2024, 0, 1, 9, 5)
    expect(formatTime(d)).toBe('09:05')
  })

  it('formats 11:59pm as 23:59', () => {
    const d = new Date(2024, 0, 1, 23, 59)
    expect(formatTime(d)).toBe('23:59')
  })

  it('formats noon as 12:00', () => {
    const d = new Date(2024, 0, 1, 12, 0)
    expect(formatTime(d)).toBe('12:00')
  })
})

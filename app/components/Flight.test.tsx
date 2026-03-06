import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Flight from './Flight'

// Mock Counter to avoid requestAnimationFrame complexity in this test file
vi.mock('./Counter', () => ({
  Counter: ({ value }: { value: number }) => <span>{value.toFixed(2)}</span>,
}))

const baseProps = {
  airport: { name: 'London Heathrow', flag: '🇬🇧', useCode: true as const },
  flightType: 'arriving' as const,
  number: 'BA123',
  plane: 'Boeing 737-800',
  airline: 'British Airways',
  distance: 1.23,
  speed: 0.05,
  callsign: 'BAW123',
}

describe('Flight', () => {
  it('renders flight number', () => {
    render(<Flight {...baseProps} />)
    expect(screen.getByText('BA123')).toBeInTheDocument()
  })

  it('shows arriving emoji for arriving flights', () => {
    render(<Flight {...baseProps} flightType="arriving" />)
    expect(screen.getByText('🛬')).toBeInTheDocument()
  })

  it('shows departing emoji for departing flights', () => {
    render(<Flight {...baseProps} flightType="departing" />)
    expect(screen.getByText('🛫')).toBeInTheDocument()
  })

  it('shows transit emoji for transit flights', () => {
    render(<Flight {...baseProps} flightType="transit" />)
    expect(screen.getByText('✈️')).toBeInTheDocument()
  })

  it('shows airline and plane type', () => {
    render(<Flight {...baseProps} />)
    expect(screen.getByText('British Airways')).toBeInTheDocument()
    expect(screen.getByText('Boeing 737-800')).toBeInTheDocument()
  })

  it('shows route when provided', () => {
    render(<Flight {...baseProps} route={{ from: 'AMS', to: 'LHR' }} />)
    expect(screen.getByText(/Amsterdam/)).toBeInTheDocument()
    // LHR has useCode:true so it shows the code
    expect(screen.getByText(/LHR/)).toBeInTheDocument()
  })

  it('shows airport name when no route provided', () => {
    render(<Flight {...baseProps} />)
    expect(screen.getByText(/London Heathrow/)).toBeInTheDocument()
  })

  it('shows - when no flight number', () => {
    render(<Flight {...baseProps} number={undefined} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('shows distance', () => {
    render(<Flight {...baseProps} distance={1.23} />)
    expect(screen.getByText('1.23')).toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Counter } from './Counter'

// requestAnimationFrame is not available in jsdom
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    return 0 // return a handle without executing cb to keep renders static
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Counter', () => {
  it('renders initial value formatted to 2 decimal places', () => {
    render(<Counter value={3.75} speed={0} />)
    expect(screen.getByText('3.75')).toBeInTheDocument()
  })

  it('renders zero value', () => {
    render(<Counter value={0} speed={0} />)
    expect(screen.getByText('0.00')).toBeInTheDocument()
  })

  it('renders a non-zero distance value', () => {
    render(<Counter value={2.5} speed={0.05} />)
    expect(screen.getByText('2.50')).toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StatsSummary from './StatsSummary';

vi.mock('../utils/flightStore', () => ({
  getStats: vi.fn().mockResolvedValue({
    todayCount: 7,
    todayCommercial: 5,
    todayNonCommercial: 2,
    topAirlines: [
      { code: 'BA', count: 12 },
      { code: 'LH', count: 6 },
    ],
    airportBreakdown: [{ code: 'LHR', count: 9 }],
    aircraftBreakdown: [],
    flightsByDay: [],
    unknownAirports: [{ code: 'XYZ', seenCount: 3, lastSeen: 0 }],
  }),
}));

vi.mock('../utils/flights', () => ({
  getAirline: (code: string) => `Airline(${code})`,
  getAirportName: (code: string) => `Airport(${code})`,
}));

describe('StatsSummary', () => {
  it('renders collapsed with toggle button', () => {
    render(<StatsSummary />);
    expect(screen.getByRole('button', { name: /flights you have seen/i })).toBeInTheDocument();
    expect(screen.queryByText(/today/i)).not.toBeInTheDocument();
  });

  it('expands and shows today flight count', async () => {
    render(<StatsSummary />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument());
  });

  it('shows non-commercial count when expanded', async () => {
    render(<StatsSummary />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
    expect(screen.getByText(/non-commercial/i)).toBeInTheDocument();
  });

  it('shows top airlines when expanded', async () => {
    render(<StatsSummary />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('Airline(BA)')).toBeInTheDocument();
      expect(screen.getByText('Airline(LH)')).toBeInTheDocument();
    });
  });

  it('shows airport breakdown when expanded', async () => {
    render(<StatsSummary />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('Airport(LHR)')).toBeInTheDocument());
  });

  it('shows unknown airports section when expanded', async () => {
    render(<StatsSummary />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('XYZ')).toBeInTheDocument();
      expect(screen.getByText('New airports seen')).toBeInTheDocument();
    });
  });

  it('collapses on second click', async () => {
    render(<StatsSummary />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    await waitFor(() => screen.getByText('7'));
    fireEvent.click(btn);
    expect(screen.queryByText('7')).not.toBeInTheDocument();
  });
});

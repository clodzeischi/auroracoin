import { describe, it, expect } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoinDashboard } from './CoinDashboard.jsx';
import { createFakeBackend } from '../test/fakeBackend.js';

const NOW = new Date('2026-09-04T12:00:00Z');

const tx = (amountMinor, category, iso) => ({
  id: `${amountMinor}-${category}-${iso}`,
  amountMinor,
  category,
  comment: '',
  user: 'parent@example.com',
  timestamp: new Date(iso),
});

const setup = () => {
  const backend = createFakeBackend();
  render(<CoinDashboard backend={backend} now={NOW} />);
  return { backend, user: userEvent.setup() };
};

const region = (name) => screen.getByRole('region', { name });

describe('CoinDashboard', () => {
  it('shows a loading state before the first snapshot', () => {
    setup();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('reports earned, spent and net for the selected range', () => {
    const { backend } = setup();

    act(() =>
      backend.emitTransactions([
        tx(3000, 'chores', '2026-09-01T00:00:00Z'),
        tx(2050, 'gift', '2026-09-02T00:00:00Z'),
        tx(-1225, 'toys', '2026-09-03T00:00:00Z'),
      ])
    );

    expect(within(region('Earned')).getByText('50.50')).toBeInTheDocument();
    expect(within(region('Spent')).getByText('12.25')).toBeInTheDocument();
    expect(within(region('Net')).getByText('+38.25')).toBeInTheDocument();
  });

  it('lists each category with its amount and share, largest first', () => {
    const { backend } = setup();

    act(() =>
      backend.emitTransactions([
        tx(2500, 'chores', '2026-09-01T00:00:00Z'),
        tx(7500, 'gift', '2026-09-02T00:00:00Z'),
      ])
    );

    const rows = within(region('Earned breakdown')).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Gift');
    expect(rows[0]).toHaveTextContent('75.00');
    expect(rows[0]).toHaveTextContent('75%');
    expect(rows[1]).toHaveTextContent('Chores');
  });

  it('names every category in text, so identity never depends on colour alone', () => {
    const { backend } = setup();

    act(() => backend.emitTransactions([tx(-800, 'books', '2026-09-01T00:00:00Z')]));

    expect(within(region('Spent breakdown')).getByText('Books')).toBeInTheDocument();
  });

  it('recomputes when the timeframe changes', async () => {
    const { backend, user } = setup();

    act(() =>
      backend.emitTransactions([
        tx(1000, 'chores', '2026-09-02T00:00:00Z'),
        tx(9000, 'gift', '2026-02-01T00:00:00Z'),
      ])
    );

    // Default is this month: only the September entry.
    expect(within(region('Earned')).getByText('10.00')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/timeframe/i), 'year');

    expect(within(region('Earned')).getByText('100.00')).toBeInTheDocument();
  });

  it('explains an empty range rather than showing bare zeroes', () => {
    const { backend } = setup();

    act(() => backend.emitTransactions([tx(5000, 'gift', '2024-01-01T00:00:00Z')]));

    expect(screen.getByText(/nothing in this period/i)).toBeInTheDocument();
  });

  it('surfaces a subscription error', () => {
    const { backend } = setup();

    act(() => backend.emitTransactionsError(new Error('permission-denied')));

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load/i);
  });
});

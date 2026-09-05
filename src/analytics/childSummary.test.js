import { describe, it, expect } from 'vitest';
import { childSummary } from './childSummary.js';

const NOW = new Date('2026-09-15T12:00:00Z');
const tx = (amountMinor, category, iso) => ({
  id: `${amountMinor}-${iso}`,
  amountMinor,
  category,
  timestamp: new Date(iso),
});

describe('childSummary', () => {
  it('is all zeroes for a child with no history', () => {
    const summary = childSummary([], NOW);

    expect(summary.balanceMinor).toBe(0);
    expect(summary.month.earnedMinor).toBe(0);
    expect(summary.month.spentMinor).toBe(0);
    expect(summary.month.topSpend).toBeNull();
  });

  it('balances over all time, not just the current month', () => {
    // The balance is what the child actually has; it cannot reset monthly.
    const summary = childSummary(
      [
        tx(5000, 'gift', '2025-03-01T00:00:00Z'),
        tx(-1000, 'toys', '2026-09-10T00:00:00Z'),
      ],
      NOW
    );

    expect(summary.balanceMinor).toBe(4000);
  });

  it('reports this month separately from the balance', () => {
    const summary = childSummary(
      [
        tx(9000, 'gift', '2026-01-05T00:00:00Z'),
        tx(4000, 'chores', '2026-09-02T00:00:00Z'),
        tx(-1500, 'toys', '2026-09-09T00:00:00Z'),
      ],
      NOW
    );

    expect(summary.month.earnedMinor).toBe(4000);
    expect(summary.month.spentMinor).toBe(1500);
    expect(summary.balanceMinor).toBe(11500);
  });

  it('names the largest spending category of the month', () => {
    const summary = childSummary(
      [
        tx(-500, 'treats', '2026-09-03T00:00:00Z'),
        tx(-2000, 'toys', '2026-09-04T00:00:00Z'),
        tx(-900, 'books', '2026-09-05T00:00:00Z'),
      ],
      NOW
    );

    expect(summary.month.topSpend).toEqual({ category: 'toys', amountMinor: 2000 });
  });

  it('has no top spend when nothing was spent this month', () => {
    const summary = childSummary([tx(4000, 'chores', '2026-09-02T00:00:00Z')], NOW);
    expect(summary.month.topSpend).toBeNull();
  });

  it('ignores malformed amounts, consistent with every other total', () => {
    const summary = childSummary(
      [tx(1000, 'chores', '2026-09-02T00:00:00Z'), tx('nope', 'gift', '2026-09-03T00:00:00Z')],
      NOW
    );

    expect(summary.balanceMinor).toBe(1000);
  });
});

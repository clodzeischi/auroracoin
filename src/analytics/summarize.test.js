import { describe, it, expect } from 'vitest';
import { rangeFor, filterByRange, summarize, TIMEFRAMES } from './summarize.js';

const at = (iso) => new Date(iso);
const tx = (amount, category, iso) => ({
  id: `${amount}-${category}-${iso}`,
  amount,
  category,
  comment: '',
  user: 'parent@example.com',
  timestamp: iso ? at(iso) : null,
});

const NOW = at('2026-09-04T12:00:00Z');

describe('rangeFor', () => {
  it('offers exactly the timeframes the UI exposes', () => {
    expect(TIMEFRAMES.map((t) => t.id)).toEqual(['month', 'quarter', 'year', 'all']);
  });

  it('starts the month range at the first of the current month', () => {
    expect(rangeFor('month', NOW).from).toEqual(at('2026-09-01T00:00:00Z'));
  });

  it('rolls the quarter range back three months from now', () => {
    expect(rangeFor('quarter', NOW).from).toEqual(at('2026-06-04T12:00:00Z'));
  });

  it('starts the year range on 1 January', () => {
    expect(rangeFor('year', NOW).from).toEqual(at('2026-01-01T00:00:00Z'));
  });

  it('leaves all-time unbounded', () => {
    expect(rangeFor('all', NOW).from).toBeNull();
  });

  it('falls back to all-time for an unknown timeframe rather than throwing', () => {
    expect(rangeFor('fortnight', NOW).from).toBeNull();
  });
});

describe('filterByRange', () => {
  const transactions = [
    tx(10, 'chores', '2026-09-02T00:00:00Z'),
    tx(5, 'gift', '2026-07-01T00:00:00Z'),
    tx(3, 'bonus', '2025-12-01T00:00:00Z'),
  ];

  it('keeps only transactions inside a bounded range', () => {
    const result = filterByRange(transactions, rangeFor('month', NOW));
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('chores');
  });

  it('keeps everything for all-time', () => {
    expect(filterByRange(transactions, rangeFor('all', NOW))).toHaveLength(3);
  });

  it('includes a pending write in all-time but excludes it from a bounded range', () => {
    // serverTimestamp() is null until the server resolves it.
    const withPending = [...transactions, tx(7, 'chores', null)];
    expect(filterByRange(withPending, rangeFor('all', NOW))).toHaveLength(4);
    expect(filterByRange(withPending, rangeFor('month', NOW))).toHaveLength(1);
  });
});

describe('summarize', () => {
  it('returns zeroed totals for an empty ledger without dividing by zero', () => {
    const result = summarize([]);
    expect(result.earned.total).toBe(0);
    expect(result.spent.total).toBe(0);
    expect(result.net).toBe(0);
    expect(result.earned.byCategory).toEqual([]);
    expect(result.spent.byCategory).toEqual([]);
  });

  it('splits earning from spending and reports spending as a positive magnitude', () => {
    const result = summarize([
      tx(10, 'chores', '2026-09-01T00:00:00Z'),
      tx(-4, 'toys', '2026-09-02T00:00:00Z'),
    ]);
    expect(result.earned.total).toBe(10);
    expect(result.spent.total).toBe(4);
    expect(result.net).toBe(6);
  });

  it('groups by category and sums within each', () => {
    const result = summarize([
      tx(10, 'chores', '2026-09-01T00:00:00Z'),
      tx(5, 'chores', '2026-09-02T00:00:00Z'),
      tx(25, 'gift', '2026-09-03T00:00:00Z'),
    ]);
    const chores = result.earned.byCategory.find((c) => c.category === 'chores');
    expect(chores.amount).toBe(15);
    expect(result.earned.byCategory).toHaveLength(2);
  });

  it('orders categories by magnitude, largest first', () => {
    const result = summarize([
      tx(5, 'chores', '2026-09-01T00:00:00Z'),
      tx(25, 'gift', '2026-09-02T00:00:00Z'),
      tx(10, 'bonus', '2026-09-03T00:00:00Z'),
    ]);
    expect(result.earned.byCategory.map((c) => c.category)).toEqual([
      'gift',
      'bonus',
      'chores',
    ]);
  });

  it('computes each category share of its own direction, summing to 100', () => {
    const result = summarize([
      tx(75, 'gift', '2026-09-01T00:00:00Z'),
      tx(25, 'chores', '2026-09-02T00:00:00Z'),
      tx(-10, 'toys', '2026-09-03T00:00:00Z'),
    ]);
    const shares = result.earned.byCategory.map((c) => c.share);
    expect(shares).toEqual([75, 25]);
    // Spending is its own denominator, not a share of everything.
    expect(result.spent.byCategory[0].share).toBe(100);
  });

  it('buckets a missing or unknown category as uncategorized', () => {
    const result = summarize([
      tx(10, undefined, '2026-09-01T00:00:00Z'),
      tx(5, 'not-a-real-category', '2026-09-02T00:00:00Z'),
    ]);
    expect(result.earned.byCategory).toHaveLength(1);
    expect(result.earned.byCategory[0].category).toBe('uncategorized');
    expect(result.earned.byCategory[0].amount).toBe(15);
  });

  it('ignores non-numeric amounts, consistent with the running total', () => {
    const result = summarize([
      tx(10, 'chores', '2026-09-01T00:00:00Z'),
      tx('twelve', 'gift', '2026-09-02T00:00:00Z'),
      tx(undefined, 'bonus', '2026-09-03T00:00:00Z'),
    ]);
    expect(result.earned.total).toBe(10);
    expect(result.earned.byCategory).toHaveLength(1);
  });

  it('ignores zero-amount entries in both directions', () => {
    const result = summarize([tx(0, 'chores', '2026-09-01T00:00:00Z')]);
    expect(result.earned.byCategory).toEqual([]);
    expect(result.spent.byCategory).toEqual([]);
  });

  it('counts the transactions it actually summarized', () => {
    const result = summarize([
      tx(10, 'chores', '2026-09-01T00:00:00Z'),
      tx(-4, 'toys', '2026-09-02T00:00:00Z'),
      tx('bad', 'gift', '2026-09-03T00:00:00Z'),
    ]);
    expect(result.count).toBe(2);
  });
});

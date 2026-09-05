import { UNCATEGORIZED, isValidCategory } from '../data/categories.js';

export const TIMEFRAMES = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'Last 3 months' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
];

/**
 * Boundaries use local time, because "this month" means the viewer's month.
 * Tests pin TZ=UTC so that stays deterministic.
 */
export function rangeFor(timeframe, now = new Date()) {
  switch (timeframe) {
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case 'quarter': {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 3);
      return { from, to: now };
    }
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    default:
      // Unknown timeframes fall back to all-time rather than throwing.
      return { from: null, to: now };
  }
}

/**
 * No upper bound is applied: a just-written transaction whose server timestamp
 * lands marginally ahead of the client clock should still appear.
 */
export function filterByRange(transactions, { from }) {
  if (!from) return transactions;
  return transactions.filter(
    (t) => t.timestamp instanceof Date && t.timestamp >= from
  );
}

const normalize = (category) => (isValidCategory(category) ? category : UNCATEGORIZED);

const toRows = (totals, directionTotal) =>
  [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      // Each direction is its own denominator: spending is a share of
      // spending, not of everything that moved.
      share: directionTotal > 0 ? (amount / directionTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

export function summarize(transactions) {
  const earnedByCategory = new Map();
  const spentByCategory = new Map();
  let earnedTotal = 0;
  let spentTotal = 0;
  let count = 0;

  for (const transaction of transactions) {
    const { amount } = transaction;
    if (!Number.isFinite(amount) || amount === 0) continue;

    count += 1;
    const category = normalize(transaction.category);

    if (amount > 0) {
      earnedTotal += amount;
      earnedByCategory.set(category, (earnedByCategory.get(category) ?? 0) + amount);
    } else {
      const magnitude = -amount;
      spentTotal += magnitude;
      spentByCategory.set(category, (spentByCategory.get(category) ?? 0) + magnitude);
    }
  }

  return {
    earned: { total: earnedTotal, byCategory: toRows(earnedByCategory, earnedTotal) },
    spent: { total: spentTotal, byCategory: toRows(spentByCategory, spentTotal) },
    net: earnedTotal - spentTotal,
    count,
  };
}

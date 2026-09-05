import { rangeFor, filterByRange, summarize } from './summarize.js';

/**
 * What a parent needs to see about one child at a glance: what they hold
 * right now, and what moved this month.
 *
 * The balance deliberately spans all time - it is the child's actual money,
 * and it cannot reset when the month does.
 */
export function childSummary(transactions, now = new Date()) {
  const allTime = summarize(transactions);
  const month = summarize(filterByRange(transactions, rangeFor('month', now)));
  const [topSpend] = month.spent.byCategory;

  return {
    balanceMinor: allTime.netMinor,
    month: {
      earnedMinor: month.earned.totalMinor,
      spentMinor: month.spent.totalMinor,
      topSpend: topSpend
        ? { category: topSpend.category, amountMinor: topSpend.amountMinor }
        : null,
    },
  };
}

import { useMemo } from 'react';
import { useTransactions } from '../hooks/useTransactions.js';
import { childSummary } from '../analytics/childSummary.js';
import { categoryLabel } from '../data/categories.js';
import { formatMinor } from '../utils/money.js';

/**
 * One child, in aggregate. Owns its own subscription so the number of
 * children is not something the parent view has to orchestrate.
 */
export const ChildSummaryCard = ({ child, ledger, now, onOpen }) => {
    const { transactions, loading, error } = useTransactions(ledger);
    const summary = useMemo(() => childSummary(transactions, now), [transactions, now]);

    return (
        <button type="button" className="child-card" onClick={onOpen} aria-label={`Open ${child.name}'s account`}>
            <div className="child-card-head">
                <span className="child-name">{child.name}</span>
                <span className="child-balance">{loading ? '—' : formatMinor(summary.balanceMinor)}</span>
            </div>

            {error ? (
                <p className="child-line is-error">Couldn't load this account.</p>
            ) : loading ? (
                <p className="child-line">Loading…</p>
            ) : summary.month.earnedMinor === 0 && summary.month.spentMinor === 0 ? (
                <p className="child-line">Nothing moved this month.</p>
            ) : (
                <p className="child-line">
                    Deposited <strong className="is-earned">{formatMinor(summary.month.earnedMinor)}</strong> this
                    month, spent <strong className="is-spent">{formatMinor(summary.month.spentMinor)}</strong>
                    {summary.month.topSpend && (
                        <> — mostly on {categoryLabel(summary.month.topSpend.category).toLowerCase()}</>
                    )}
                    .
                </p>
            )}
        </button>
    );
};

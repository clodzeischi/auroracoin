import { useMemo } from 'react';
import { useTransactions } from '../hooks/useTransactions.js';
import { childSummary } from '../analytics/childSummary.js';
import { categoryLabel } from '../data/categories.js';
import { formatMinor } from '../utils/money.js';

/**
 * One child, in aggregate. Owns its own subscription so the number of
 * children is not something the parent view has to orchestrate.
 *
 * The card is a region rather than a button: it has to contain rename and
 * delete controls, and buttons cannot nest. The child's name is the control
 * that opens the account, so a keyboard still reaches it.
 */
export const ChildSummaryCard = ({
    child, ledger, now, deviceCount = 0, onOpen, onRename, onPair, onDelete,
}) => {
    const { transactions, loading, error } = useTransactions(ledger);
    const summary = useMemo(() => childSummary(transactions, now), [transactions, now]);

    const stop = (handler) => (event) => {
        event.stopPropagation();
        handler();
    };

    return (
        <section className="child-card" aria-label={`${child.name}'s account`} onClick={onOpen}>
            <div className="child-card-head">
                <button
                    type="button"
                    className="child-name"
                    aria-label={`Open ${child.name}'s account`}
                    onClick={stop(onOpen)}
                >
                    {child.name}
                </button>
                <span className="child-balance">
                    {loading ? '—' : formatMinor(summary.balanceMinor)}
                </span>
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

            <div className="child-card-actions">
                <button
                    type="button"
                    className="link-btn"
                    aria-label={`Rename ${child.name}`}
                    onClick={stop(onRename)}
                >
                    Rename
                </button>
                <button
                    type="button"
                    className="link-btn"
                    aria-label={
                        deviceCount > 0
                            ? `Manage devices for ${child.name}`
                            : `Pair a device for ${child.name}`
                    }
                    onClick={stop(onPair)}
                >
                    {deviceCount > 0
                        ? `Device${deviceCount > 1 ? 's' : ''} (${deviceCount})`
                        : 'Pair device'}
                </button>
                <button
                    type="button"
                    className="link-btn is-danger"
                    aria-label={`Delete ${child.name}'s account`}
                    onClick={stop(onDelete)}
                >
                    Delete
                </button>
            </div>
        </section>
    );
};

import { useMemo, useState } from 'react';
import { useTransactions } from '../hooks/useTransactions.js';
import { categoryLabel } from '../data/categories.js';
import { formatMinor, formatMinorSigned } from '../utils/money.js';
import { TIMEFRAMES, rangeFor, filterByRange, summarize } from '../analytics/summarize.js';

// Colour encodes direction only — green in, violet out. Category identity is
// carried by the row label, so no categorical palette is needed. Both the
// light and dark pairs are separately validated against their own surface.
const Breakdown = ({ title, rows, total, tone }) => (
    <section aria-label={title}>
        <div className="bd-head">
            <h3 className="bd-title">{title}</h3>
            <span className="bd-total">{formatMinor(total)}</span>
        </div>
        {rows.length === 0 ? (
            <p className="bd-empty">Nothing in this period.</p>
        ) : (
            <ul className="bd-list">
                {rows.map((row) => (
                    <li key={row.category}>
                        <div className="bd-row-top">
                            <span className="bd-name">{categoryLabel(row.category)}</span>
                            <span className="bd-figures">
                                {formatMinor(row.amountMinor)}
                                <span className="bd-share">{Math.round(row.share)}%</span>
                            </span>
                        </div>
                        <div className="bd-track">
                            <div
                                className={`bd-fill is-${tone}`}
                                style={{ width: `${Math.max(row.share, 2)}%` }}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        )}
    </section>
);

const Stat = ({ label, value, tone }) => (
    <section aria-label={label}>
        <p className="stat-label">{label}</p>
        <p className={`stat-value${tone ? ` is-${tone}` : ''}`}>{value}</p>
    </section>
);

export const CoinDashboard = ({ backend, now }) => {
    const { transactions, loading, error } = useTransactions(backend);
    const [timeframe, setTimeframe] = useState('month');
    // Captured once so the range does not drift on every render.
    const [reference] = useState(() => now ?? new Date());

    const summary = useMemo(
        () => summarize(filterByRange(transactions, rangeFor(timeframe, reference))),
        [transactions, timeframe, reference]
    );

    if (error) {
        return (
            <div className="card">
                <p role="alert" className="state is-error">Couldn't load the breakdown.</p>
            </div>
        );
    }
    if (loading) {
        return (
            <div className="card">
                <p className="state">Loading breakdown…</p>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-head">
                <div className="stats">
                    <Stat label="Earned" value={formatMinor(summary.earned.totalMinor)} tone="earned" />
                    <Stat label="Spent" value={formatMinor(summary.spent.totalMinor)} tone="spent" />
                    <Stat label="Net" value={formatMinorSigned(summary.netMinor)} />
                </div>
                <div>
                    <label htmlFor="timeframe" className="sr-only">Timeframe</label>
                    <select
                        id="timeframe"
                        className="select"
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                    >
                        {TIMEFRAMES.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {summary.count === 0 ? (
                <p className="state">Nothing in this period.</p>
            ) : (
                <div className="breakdowns">
                    <Breakdown
                        title="Earned breakdown"
                        rows={summary.earned.byCategory}
                        total={summary.earned.totalMinor}
                        tone="earned"
                    />
                    <Breakdown
                        title="Spent breakdown"
                        rows={summary.spent.byCategory}
                        total={summary.spent.totalMinor}
                        tone="spent"
                    />
                </div>
            )}
        </div>
    );
}

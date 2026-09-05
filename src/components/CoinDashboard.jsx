import { useMemo, useState } from 'react';
import { useTransactions } from '../hooks/useTransactions.js';
import { categoryLabel } from '../data/categories.js';
import { TIMEFRAMES, rangeFor, filterByRange, summarize } from '../analytics/summarize.js';

// Two hues, one per direction. Category identity is carried by the row label,
// not by colour, so no categorical palette is needed. This pair passes the
// six-check validator on a light surface (deutan dE 22.1, normal-vision 29.1).
const EARNED_HUE = '#00915F';
const SPENT_HUE = '#6B4BC4';

const Breakdown = ({ title, rows, total, hue }) => (
    <section
        aria-label={title}
        className="mb-4"
        style={{ minWidth: 0 }}
    >
        <div className="d-flex justify-content-between align-items-baseline mb-2">
            <h3 className="h6 text-uppercase mb-0" style={{ letterSpacing: '.08em', fontSize: '.72rem', color: '#6c757d' }}>
                {title}
            </h3>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{total}</span>
        </div>
        {rows.length === 0 ? (
            <p className="text-muted small mb-0">Nothing in this period.</p>
        ) : (
            <ul className="list-unstyled mb-0">
                {rows.map((row) => (
                    <li key={row.category} className="mb-2">
                        <div className="d-flex justify-content-between align-items-baseline"
                             style={{ fontSize: '.9rem', gap: '.75rem' }}>
                            <span>{categoryLabel(row.category)}</span>
                            <span className="text-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {row.amount}
                                <span className="text-muted ms-2">{Math.round(row.share)}%</span>
                            </span>
                        </div>
                        {/* Track and fill: 8px bar, rounded data end anchored at zero. */}
                        <div style={{ height: 8, background: '#eceeed', borderRadius: 4, marginTop: 4 }}>
                            <div
                                style={{
                                    height: '100%',
                                    width: `${Math.max(row.share, 1.5)}%`,
                                    background: hue,
                                    borderRadius: 4,
                                }}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        )}
    </section>
);

const Stat = ({ label, value, tone }) => (
    <section aria-label={label} className="flex-fill" style={{ minWidth: 96 }}>
        <div className="text-uppercase text-muted" style={{ fontSize: '.68rem', letterSpacing: '.08em' }}>
            {label}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: tone }}>
            {value}
        </div>
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
        return <p role="alert" className="text-danger">Couldn't load the breakdown.</p>;
    }
    if (loading) {
        return <p className="text-muted">Loading breakdown...</p>;
    }

    return (
        <div className="px-3 pb-3">
            <div className="d-flex justify-content-between align-items-center mb-3" style={{ gap: '1rem' }}>
                <div className="d-flex flex-wrap" style={{ gap: '1.5rem', flex: 1 }}>
                    <Stat label="Earned" value={summary.earned.total} tone={EARNED_HUE} />
                    <Stat label="Spent" value={summary.spent.total} tone={SPENT_HUE} />
                    <Stat
                        label="Net"
                        value={`${summary.net >= 0 ? '+' : ''}${summary.net}`}
                    />
                </div>
                <div>
                    <label htmlFor="timeframe" className="visually-hidden">Timeframe</label>
                    <select
                        id="timeframe"
                        className="form-select form-select-sm"
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
                <p className="text-muted small mb-0">Nothing in this period.</p>
            ) : (
                <div className="row">
                    <div className="col-md-6">
                        <Breakdown
                            title="Earned breakdown"
                            rows={summary.earned.byCategory}
                            total={summary.earned.total}
                            hue={EARNED_HUE}
                        />
                    </div>
                    <div className="col-md-6">
                        <Breakdown
                            title="Spent breakdown"
                            rows={summary.spent.byCategory}
                            total={summary.spent.total}
                            hue={SPENT_HUE}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

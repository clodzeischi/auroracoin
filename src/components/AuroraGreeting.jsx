import { useMemo, useState } from 'react';
import { useTransactions } from '../hooks/useTransactions.js';
import { MOOD_IMAGE } from '../data/mascot.js';
import { auroraFacts, pickAuroraLine } from '../data/auroraLines.js';
import { formatMinor } from '../utils/money.js';

/**
 * What a child sees first: Aurora, greeting them by name.
 *
 * This stands where the big balance hero used to. The number has not gone -
 * she says it - because the breakdown below is scoped to a timeframe and so
 * never states the actual balance, and the balance is the one thing a child
 * opens this app to find out.
 *
 * No typewriter here, deliberately. The intro is a cutscene you watch once;
 * this is a screen you come back to several times a day, and making the
 * number type itself in would be charming exactly once.
 */
export const AuroraGreeting = ({ child, ledger, now, roll }) => {
    const { transactions, totalMinor, loading, error } = useTransactions(ledger);

    // Both captured once: the line should hold still while it is being read,
    // and be a different one next time the app is opened.
    const [seed] = useState(() => (typeof roll === 'number' ? roll : Math.random()));
    const [reference] = useState(() => now ?? new Date());

    const line = useMemo(
        () => pickAuroraLine(auroraFacts(transactions, reference), seed),
        [transactions, reference, seed]
    );

    const greeting = child ? `Hi, ${child.name}!` : 'Hi there!';
    const tone = totalMinor < 0 ? 'is-spent' : 'is-earned';

    return (
        <section className="aurora-greet" aria-label={greeting}>
            <div className="mascot-scene">
                <img className="mascot" src={MOOD_IMAGE[line?.mood ?? 'hi']} alt="" />
                <div className="mascot-bubble">
                    <p className="mascot-line">{greeting}</p>

                    {error ? (
                        <p className="aurora-balance">I can't reach your coins right now.</p>
                    ) : (
                        <p className="aurora-balance">
                            You have{' '}
                            <span className={`aurora-count ${loading ? '' : tone}`}>
                                {loading ? '—' : formatMinor(totalMinor)}
                            </span>{' '}
                            coins right now.
                        </p>
                    )}

                    {!error && !loading && line && <p className="aurora-note">{line.text}</p>}
                </div>
            </div>
        </section>
    );
};

import { useTransactions } from '../hooks/useTransactions.js';
import { formatMinor } from '../utils/money.js';

export const CoinCount = ({ ledger, label = 'Total balance' }) => {
    const { totalMinor, loading, error } = useTransactions(ledger);

    // Green for a balance at or above zero, violet for a deficit - the same
    // in/out pairing used everywhere else, so the one number every persona
    // reads first still says at a glance whether it is healthy.
    const tone = totalMinor < 0 ? 'is-spent' : 'is-earned';

    return (
        <section className="balance" aria-label={label}>
            <p className="balance-label">{label}</p>
            {error ? (
                <p className="balance-error">Couldn't load the balance.</p>
            ) : (
                <p className={`balance-value${loading ? '' : ` ${tone}`}`}>
                    {loading ? '—' : formatMinor(totalMinor)}
                    <span className="balance-unit">coins</span>
                </p>
            )}
        </section>
    );
}

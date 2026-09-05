import { useTransactions } from '../hooks/useTransactions.js';
import { formatMinor } from '../utils/money.js';

export const CoinCount = ({ ledger, label = 'Total balance' }) => {
    const { totalMinor, loading, error } = useTransactions(ledger);

    return (
        <section className="balance" aria-label={label}>
            <p className="balance-label">{label}</p>
            {error ? (
                <p className="balance-error">Couldn't load the balance.</p>
            ) : (
                <p className="balance-value">
                    {loading ? '—' : formatMinor(totalMinor)}
                    <span className="balance-unit">coins</span>
                </p>
            )}
        </section>
    );
}

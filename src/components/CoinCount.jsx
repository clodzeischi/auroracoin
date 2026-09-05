import { useTransactions } from '../hooks/useTransactions.js';
import { formatMinor } from '../utils/money.js';

export const CoinCount = () => {
    const { totalMinor, loading, error } = useTransactions();

    return (
        <section className="balance" aria-label="Total balance">
            <p className="balance-label">Total balance</p>
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

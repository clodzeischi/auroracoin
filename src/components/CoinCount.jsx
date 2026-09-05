import { useTransactions } from '../hooks/useTransactions.js';

export const CoinCount = () => {
    const { totalCoins, loading, error } = useTransactions();

    return (
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', padding: '1rem' }}>
            {error
                ? <span className="text-danger">Couldn't load the balance.</span>
                : <>Total Coins: {loading ? '...' : totalCoins}</>}
        </div>
    );
}

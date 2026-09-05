import { useEffect, useMemo, useState } from 'react';
import { getBackend } from '../data/index.js';

// Summed in integer hundredths, so the total is exact. A single malformed
// document must not turn the whole balance into NaN.
const sumAmounts = (transactions) =>
  transactions.reduce(
    (total, transaction) =>
      Number.isFinite(transaction.amountMinor) ? total + transaction.amountMinor : total,
    0
  );

export const useTransactions = (backend = getBackend()) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = backend.subscribeToTransactions(
      (next) => {
        setTransactions(next);
        setError(null);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(subscriptionError);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [backend]);

  const totalMinor = useMemo(() => sumAmounts(transactions), [transactions]);

  return { transactions, totalMinor, loading, error };
};

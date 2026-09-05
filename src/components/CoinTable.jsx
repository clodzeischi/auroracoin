import {TableRow} from "./TableRow.jsx";
import {useTransactions} from "../hooks/useTransactions.js";
import {categoryLabel} from "../data/categories.js";

const formatTime = (timestamp) =>
    timestamp
        ? timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '—';

export const CoinTable = () => {

    const { transactions, loading, error } = useTransactions();

    return (
        <div className="card">
            <div className="card-head">
                <h2 className="card-title">Ledger</h2>
                {!loading && !error && (
                    <span className="bd-title">{transactions.length} entries</span>
                )}
            </div>

            {error ? (
                <p className="state is-error">Couldn't load transactions.</p>
            ) : loading ? (
                <p className="state">Loading transactions…</p>
            ) : transactions.length === 0 ? (
                <p className="state">No transactions yet.</p>
            ) : (
                <div className="ledger-wrap">
                    <table className="ledger">
                        <thead>
                            <tr>
                                <th>Amount</th>
                                <th>Category</th>
                                <th>Date</th>
                                <th className="hide-sm">Added by</th>
                                <th>Comment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((transaction) => (
                                <TableRow
                                    key={transaction.id}
                                    data={{
                                        amount: transaction.amount,
                                        category: categoryLabel(transaction.category),
                                        time: formatTime(transaction.timestamp),
                                        user: transaction.user || '—',
                                        comment: transaction.comment || '—',
                                    }}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

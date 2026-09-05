import {useState} from "react";
import {TableRow} from "./TableRow.jsx";
import {CoinForm} from "./CoinForm.jsx";
import {ConfirmDialog} from "./ConfirmDialog.jsx";
import {useTransactions} from "../hooks/useTransactions.js";
import {categoryLabel} from "../data/categories.js";
import {formatEditedNote, personLabel} from "../utils/format.js";
import {formatMinorSigned} from "../utils/money.js";
import {isChild} from "../data/roles.js";

const formatTime = (timestamp) =>
    timestamp
        ? timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '—';

export const CoinTable = ({ backend, user }) => {

    const readOnly = isChild(user);
    const { transactions, loading, error } = useTransactions(backend);
    const [editing, setEditing] = useState(null);
    const [confirming, setConfirming] = useState(null);

    const confirmDelete = async () => {
        const target = confirming;
        setConfirming(null);
        await backend.deleteTransaction(target.id);
    };

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
                                {!readOnly && <th className="hide-sm">Added by</th>}
                                <th>Comment</th>
                                {!readOnly && <th><span className="sr-only">Actions</span></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((transaction) => (
                                <TableRow
                                    key={transaction.id}
                                    readOnly={readOnly}
                                    onEdit={readOnly ? undefined : () => setEditing(transaction)}
                                    onDelete={readOnly ? undefined : () => setConfirming(transaction)}
                                    data={{
                                        amountMinor: transaction.amountMinor,
                                        display: formatMinorSigned(transaction.amountMinor),
                                        category: categoryLabel(transaction.category),
                                        time: formatTime(transaction.timestamp),
                                        user: personLabel(transaction.userName, transaction.user),
                                        comment: transaction.comment || '—',
                                        editedNote: readOnly ? null : formatEditedNote(transaction),
                                    }}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Keyed by id so the form remounts with fresh state per entry. */}
            {!readOnly && <CoinForm
                key={editing ? editing.id : 'none'}
                isOpen={Boolean(editing)}
                toggle={() => setEditing(null)}
                user={user}
                backend={backend}
                transaction={editing}
            />}

            {!readOnly && <ConfirmDialog
                isOpen={Boolean(confirming)}
                title="Delete this transaction?"
                detail={confirming
                    ? `${formatMinorSigned(confirming.amountMinor)} coins · ${categoryLabel(confirming.category)}`
                    : ''}
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                onCancel={() => setConfirming(null)}
            />}
        </div>
    )
}

import {useEffect, useRef, useState} from "react";
import {getBackend} from "../data/index.js";
import {categoriesForAmount} from "../data/categories.js";
import {parseAmountInput, formatMinor} from "../utils/money.js";

// Amounts are entered as decimals and stored as integer hundredths, which is
// also what the Firestore rule validates (`amountMinor is int`).
const parseAmount = parseAmountInput;

export const CoinForm = ({ isOpen, toggle, user, backend = getBackend(), transaction = null }) => {

    const isEditing = Boolean(transaction);
    const [amount, setAmount] = useState(isEditing ? formatMinor(transaction.amountMinor) : '');
    const [category, setCategory] = useState(transaction?.category ?? '');
    const [comment, setComment] = useState(transaction?.comment ?? '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const amountRef = useRef(null);

    // Escape closes, and the first field takes focus on open - both of which
    // the component library used to provide.
    useEffect(() => {
        if (!isOpen) return undefined;
        amountRef.current?.focus();
        const onKeyDown = (event) => {
            if (event.key === 'Escape') toggle();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, toggle]);

    if (!isOpen) return null;

    const parsedAmount = parseAmount(amount);
    const categoryOptions = categoriesForAmount(parsedAmount);

    const handleAmountChange = (nextAmount) => {
        setAmount(nextAmount);
        // Earning and spending have disjoint category sets, so a category
        // chosen before the sign flipped is no longer a legal choice. Only
        // act once the new amount is usable: while the field is empty or
        // half-typed there are no options at all, and clearing then would
        // wipe the category every time someone retypes an amount.
        const nextOptions = categoriesForAmount(parseAmount(nextAmount));
        if (nextOptions.length > 0 && !nextOptions.some((option) => option.id === category)) {
            setCategory('');
        }
    };

    const handleSubmit = async () => {
        if (parsedAmount === null) {
            setError('Enter a non-zero amount with up to two decimal places.');
            return;
        }
        if (!category) {
            setError('Choose a category.');
            return;
        }
        if (!user) {
            setError('You must be signed in to add a transaction.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            if (isEditing) {
                // Authorship and date are not sent: the rules pin them, so an
                // edit records who changed it without rewriting who made it.
                await backend.updateTransaction(transaction.id, {
                    amountMinor: parsedAmount,
                    comment,
                    category,
                    editedBy: user.email,
                    editedByName: user.displayName ?? null,
                });
            } else {
                await backend.addTransaction({
                    amountMinor: parsedAmount,
                    comment,
                    category,
                    user: user.email,
                    userName: user.displayName ?? null,
                });
                setAmount('');
                setCategory('');
                setComment('');
            }
            toggle();
        }
        catch {
            setError('Could not save that transaction. Please try again.');
        }
        finally {
            setLoading(false);
        }
    }

    return (
        <div className="overlay" onMouseDown={toggle}>
            <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="coin-form-title"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="modal-head">
                    <h2 className="modal-title" id="coin-form-title">
                        {isEditing ? 'Edit transaction' : 'Add transaction'}
                    </h2>
                    <button className="modal-close" onClick={toggle} aria-label="Close">×</button>
                </div>

                <div className="modal-body">
                    <div className="field">
                        <label htmlFor="amount">Amount</label>
                        <input
                            ref={amountRef}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            id="amount"
                            value={amount}
                            onChange={e => handleAmountChange(e.target.value)}
                        />
                        <span className="field-hint">
                            Positive to give coins, negative to spend them.
                        </span>
                    </div>

                    <div className="field">
                        <label htmlFor="category">Category</label>
                        <select
                            id="category"
                            value={category}
                            disabled={categoryOptions.length === 0}
                            onChange={e => setCategory(e.target.value)}
                        >
                            <option value="">
                                {categoryOptions.length === 0
                                    ? 'Enter an amount first'
                                    : 'Choose a category'}
                            </option>
                            {categoryOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="field">
                        <label htmlFor="comment">Comment</label>
                        <input
                            type="text"
                            id="comment"
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />
                    </div>

                    {error && <div role="alert" className="alert">{error}</div>}
                </div>

                <div className="modal-foot">
                    <button className="btn btn-quiet" onClick={toggle}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving…' : isEditing ? 'Save' : 'Submit'}
                    </button>
                </div>
            </div>
        </div>
    )
}

import {useEffect, useRef, useState} from "react";
import {Modal} from "./Modal.jsx";
import {categoriesForAmount} from "../data/categories.js";
import {parseAmountInput, formatMinor} from "../utils/money.js";
import {useTransactions} from "../hooks/useTransactions.js";

// Amounts are entered as decimals and stored as integer hundredths, which is
// also what the Firestore rule validates (`amountMinor is int`).
const parseAmount = parseAmountInput;

// 1,000,000 hundredths is $10,000 on a single entry - mirrored in
// firestore.rules' hasValidCore, which is the actual enforcement; this copy
// exists only so a typo gets a specific message instead of the generic
// "could not save" a rules rejection produces.
const MAX_TRANSACTION_MINOR = 1_000_000;

// 100,000,000 hundredths is $1,000,000 either direction. Rules cannot sum a
// whole subcollection on every write, so unlike the cap above, this one is a
// client-side guard only, not a security boundary - a parent editing the
// database directly could still exceed it.
const MAX_BALANCE_MINOR = 100_000_000;

export const CoinForm = ({ isOpen, toggle, user, backend, transaction = null }) => {

    const isEditing = Boolean(transaction);
    // Direction is chosen explicitly rather than read off a typed minus sign:
    // iOS Safari's numeric keypad has no minus key, so the amount field below
    // only ever holds a magnitude - see handleSubmit for where the sign is
    // put back on.
    const [direction, setDirection] = useState(
        isEditing && transaction.amountMinor < 0 ? 'spent' : 'earned'
    );
    const [amount, setAmount] = useState(isEditing ? formatMinor(Math.abs(transaction.amountMinor)) : '');
    const [category, setCategory] = useState(transaction?.category ?? '');
    const [comment, setComment] = useState(transaction?.comment ?? '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const amountRef = useRef(null);

    // For the running-balance cap only - always subscribed, same as
    // CoinCount/CoinDashboard/CoinTable, so it already has data by the time
    // this form is opened rather than racing the first render after.
    const { totalMinor, loading: balanceLoading } = useTransactions(backend);

    // Escape and click-away are Modal's job; the amount field taking focus on
    // open is this form's own, since Modal makes no assumption about which
    // field that should be.
    useEffect(() => {
        if (!isOpen) return undefined;
        amountRef.current?.focus();
    }, [isOpen]);

    if (!isOpen) return null;

    const signOf = (dir) => (dir === 'spent' ? -1 : 1);
    const magnitude = parseAmount(amount);
    const parsedAmount = magnitude === null ? null : Math.abs(magnitude) * signOf(direction);
    const categoryOptions = categoriesForAmount(signOf(direction));

    const chooseDirection = (nextDirection) => {
        setDirection(nextDirection);
        // Earning and spending have disjoint category sets, so a category
        // chosen under the old direction is no longer a legal choice.
        const nextOptions = categoriesForAmount(signOf(nextDirection));
        if (!nextOptions.some((option) => option.id === category)) {
            setCategory('');
        }
    };

    const handleSubmit = async () => {
        if (parsedAmount === null) {
            setError('Enter a non-zero amount with up to two decimal places.');
            return;
        }
        if (Math.abs(parsedAmount) > MAX_TRANSACTION_MINOR) {
            setError(`A single transaction can't be more than ${formatMinor(MAX_TRANSACTION_MINOR)} coins.`);
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
        // Editing replaces the prior amount rather than adding to it, so the
        // balance this edit would produce has to subtract that amount back
        // out first - otherwise correcting a typo down would look like it
        // was still pushing the balance further past the cap.
        if (!balanceLoading) {
            const priorAmount = isEditing ? transaction.amountMinor : 0;
            const resultingBalance = totalMinor - priorAmount + parsedAmount;
            if (Math.abs(resultingBalance) > MAX_BALANCE_MINOR) {
                setError(`That would put the balance past ${formatMinor(MAX_BALANCE_MINOR)} coins.`);
                return;
            }
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
        <Modal
            title={isEditing ? 'Edit transaction' : 'Add transaction'}
            titleId="coin-form-title"
            small={false}
            onClose={toggle}
            foot={
                <>
                    <button className="btn btn-quiet" onClick={toggle}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving…' : isEditing ? 'Save' : 'Submit'}
                    </button>
                </>
            }
        >
            <div className="field">
                <span className="field-label">Type</span>
                {/* Two buttons rather than a typed sign, so this works the same
                    whether or not the device's keyboard offers a minus key. */}
                <div className="direction-toggle" role="group" aria-label="Type">
                    <button
                        type="button"
                        className={`direction-btn is-earned${direction === 'earned' ? ' is-active' : ''}`}
                        aria-pressed={direction === 'earned'}
                        onClick={() => chooseDirection('earned')}
                    >
                        Earned
                    </button>
                    <button
                        type="button"
                        className={`direction-btn is-spent${direction === 'spent' ? ' is-active' : ''}`}
                        aria-pressed={direction === 'spent'}
                        onClick={() => chooseDirection('spent')}
                    >
                        Spent
                    </button>
                </div>
            </div>

            <div className="field">
                <label htmlFor="amount">Amount</label>
                <input
                    ref={amountRef}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max={formatMinor(MAX_TRANSACTION_MINOR)}
                    id="amount"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                />
                <span className="field-hint">
                    {direction === 'earned' ? 'Added to the balance.' : 'Taken from the balance.'}
                </span>
            </div>

            <div className="field">
                <label htmlFor="category">Category</label>
                <select
                    id="category"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                >
                    <option value="">Choose a category</option>
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
        </Modal>
    )
}

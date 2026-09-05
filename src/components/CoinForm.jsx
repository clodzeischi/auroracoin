import {Button, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader} from "reactstrap";
import {useState} from "react";
import {getBackend} from "../data/index.js";
import {categoriesForAmount} from "../data/categories.js";

/**
 * Coins are whole units. Returns null for anything we refuse to write, so the
 * client and the Firestore rule (`amount is int`) agree on what is valid.
 */
const parseAmount = (raw) => {
    const trimmed = String(raw).trim();
    if (trimmed === '') return null;
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value === 0) return null;
    return value;
};

export const CoinForm = ({ isOpen, toggle, user, backend = getBackend() }) => {

    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const parsedAmount = parseAmount(amount);
    const categoryOptions = categoriesForAmount(parsedAmount);

    const handleAmountChange = (nextAmount) => {
        setAmount(nextAmount);
        // Earning and spending have disjoint category sets, so a category
        // chosen before the sign flipped is no longer a legal choice.
        const nextOptions = categoriesForAmount(parseAmount(nextAmount));
        if (!nextOptions.some((option) => option.id === category)) {
            setCategory('');
        }
    };

    const handleSubmit = async () => {
        if (parsedAmount === null) {
            setError('Enter a non-zero whole number of coins.');
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
            await backend.addTransaction({
                amount: parsedAmount,
                comment,
                category,
                user: user.email,
            });
            setAmount('');
            setCategory('');
            setComment('');
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
        <Modal isOpen={isOpen} toggle={toggle}>
            <ModalHeader toggle={toggle}>Add transaction</ModalHeader>
            <ModalBody>
                <FormGroup>
                    <Label for="amount">Amount</Label>
                    <Input type="number" id="amount" value={amount}
                           onChange={e => handleAmountChange(e.target.value)} />
                </FormGroup>
                <FormGroup>
                    <Label for="category">Category</Label>
                    <Input type="select" id="category" value={category}
                           disabled={categoryOptions.length === 0}
                           onChange={e => setCategory(e.target.value)}>
                        <option value="">
                            {categoryOptions.length === 0
                                ? 'Enter an amount first'
                                : 'Choose a category'}
                        </option>
                        {categoryOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                    </Input>
                </FormGroup>
                <FormGroup>
                    <Label for="comment">Comment</Label>
                    <Input type="text" id="comment" value={comment}
                           onChange={e => setComment(e.target.value)} />
                </FormGroup>
                {error && <div role="alert" className="text-danger">{error}</div>}
            </ModalBody>
            <ModalFooter>
                <Button color="primary" onClick={handleSubmit} disabled={loading}>
                    {loading? 'Submitting...' : 'Submit'}
                </Button>{' '}
                <Button color="secondary" onClick={toggle}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    )
}

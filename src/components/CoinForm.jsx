import {Button, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader} from "reactstrap";
import {useState} from "react";
import {getBackend} from "../data/index.js";

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
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async () => {
        const parsedAmount = parseAmount(amount);
        if (parsedAmount === null) {
            setError('Enter a non-zero whole number of coins.');
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
                user: user.email,
            });
            setAmount('');
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
                           onChange={e => setAmount(e.target.value)} />
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

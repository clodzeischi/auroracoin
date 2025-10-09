import {Button, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader} from "reactstrap";
import {useState} from "react";
import {collection, addDoc, serverTimestamp} from "firebase/firestore";
import {db} from "../firebase.js";

export const CoinForm = ({ isOpen, toggle, user }) => {

    const [amount, setAmount] = useState('');
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!amount || isNaN(parseInt(amount))) return alert('Enter a valid number');
        if (!user) return alert('You must be logged in');

        setLoading(true);
        try {
            await addDoc(collection(db, 'transactions'), {
                amount: parseInt(amount),
                comment: comment,
                user: user.email,
                timestamp: serverTimestamp()
            });
            setAmount('');
            setComment('');
            toggle();
        }
        catch (e) {
            console.log(e);
            alert('Failed to add transaction');
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
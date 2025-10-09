import {Table} from "reactstrap";
import {TableRow} from "./TableRow.jsx";
import {useEffect, useState} from "react";
import {collection, query, orderBy, onSnapshot} from "firebase/firestore";
import {db} from "../firebase.js";

export const CoinTable = () => {

    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, snapshot => {
            const data = snapshot.docs.map(doc => {
                const tx = doc.data();
                return {
                    amount: tx.amount,
                    time: tx.timestamp ? tx.timestamp.toDate().toLocaleString() : 'N/A',
                    user: tx.user || 'N/A',
                    comment: tx.comment || 'N/A',
                };
            });
            setTransactions(data);
        });

        return () => unsubscribe();
    }, []);

    return (
        <Table striped>
            <thead>
                <tr>
                    <th>Amount</th>
                    <th>Time</th>
                    <th className="d-none d-md-table-cell">User</th>
                    <th>Comment</th>
                </tr>
            </thead>
            <tbody>
                {transactions.map( (predicate, index) => (<TableRow key={index} data={predicate}/>))}
            </tbody>
        </Table>
    )
}
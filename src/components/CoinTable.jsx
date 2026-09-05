import {Table} from "reactstrap";
import {TableRow} from "./TableRow.jsx";
import {useTransactions} from "../hooks/useTransactions.js";

const formatTime = (timestamp) => timestamp ? timestamp.toLocaleString() : 'N/A';

export const CoinTable = () => {

    const { transactions, loading, error } = useTransactions();

    if (error) {
        return <p className="text-danger">Couldn't load transactions.</p>;
    }
    if (loading) {
        return <p>Loading transactions...</p>;
    }

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
                {transactions.map((transaction) => (
                    <TableRow
                        key={transaction.id}
                        data={{
                            amount: transaction.amount,
                            time: formatTime(transaction.timestamp),
                            user: transaction.user || 'N/A',
                            comment: transaction.comment || 'N/A',
                        }}
                    />
                ))}
            </tbody>
        </Table>
    )
}

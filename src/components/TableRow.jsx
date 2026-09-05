export const TableRow = ( {data} ) => {

    const tone = data.amount >= 0 ? 'earned' : 'spent';

    return (
        <tr>
            <td className={`amount is-${tone}`}>
                {data.amount > 0 ? `+${data.amount}` : data.amount}
            </td>
            <td><span className={`chip is-${tone}`}>{data.category}</span></td>
            <td className="cell-time">{data.time}</td>
            <td className="cell-user hide-sm">{data.user}</td>
            <td className="cell-comment">{data.comment}</td>
        </tr>
    )
}

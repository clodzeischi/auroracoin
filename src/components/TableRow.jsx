export const TableRow = ( {data} ) => {

    return (
        <tr>
            <th scope="row">{data.amount}</th>
            <td>{data.time}</td>
            <td className="d-none d-md-table-cell">{data.user}</td>
            <td>{data.comment}</td>
        </tr>
    )
}
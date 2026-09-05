export const TableRow = ({ data, onEdit, onDelete }) => {

    const tone = data.amountMinor >= 0 ? 'earned' : 'spent';
    const display = data.display;
    const describe = `${display} coins, ${data.category}`;

    return (
        <tr className="ledger-row" onClick={onEdit}>
            <td className="cell-amount">
                {/* The amount itself is the control, so "click the deposit"
                    also works from a keyboard and reads correctly aloud. */}
                <button
                    type="button"
                    className={`amount-btn is-${tone}`}
                    aria-label={`Edit transaction: ${describe}`}
                    onClick={onEdit}
                >
                    {display}
                </button>
            </td>
            <td><span className={`chip is-${tone}`}>{data.category}</span></td>
            <td className="cell-time">{data.time}</td>
            <td className="cell-user hide-sm">{data.user}</td>
            <td className="cell-comment">
                {data.comment}
                {data.editedNote && <span className="edited-note">{data.editedNote}</span>}
            </td>
            <td className="cell-actions">
                <button
                    type="button"
                    className="row-delete"
                    aria-label={`Delete transaction: ${describe}`}
                    onClick={(event) => { event.stopPropagation(); onDelete(); }}
                >
                    ×
                </button>
            </td>
        </tr>
    )
}

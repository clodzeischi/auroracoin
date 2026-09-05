/**
 * A list of things that can be taken back: pending invites, unused pairing
 * codes, paired devices. All three are a label and one destructive control per
 * row, and all three should stay silent when there is nothing to show.
 */
export const RevocableList = ({ label, items, action = 'Cancel', onRevoke }) => {
    if (items.length === 0) return null;

    return (
        <ul className="pending-list" aria-label={label}>
            {items.map((item) => (
                <li key={item.id}>
                    <span className={item.labelClassName}>{item.label}</span>
                    <button
                        type="button"
                        className="link-btn is-danger"
                        aria-label={item.actionLabel}
                        onClick={() => onRevoke(item.id)}
                    >
                        {action}
                    </button>
                </li>
            ))}
        </ul>
    );
};

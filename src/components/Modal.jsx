import { useEffect } from 'react';

/**
 * The shell every dialog shares: a click-away overlay, Escape to close, and
 * the head/body/foot frame.
 *
 * Extracted at the third copy. The accessibility details - aria-modal, the
 * title the dialog is labelled by, and stopping a mousedown inside the card
 * from reaching the overlay that closes it - were being got right
 * independently in each dialog, which is exactly the kind of thing that
 * silently stops being right in the fourth.
 *
 * `dismissible` is the one real difference between them: a dialog you can walk
 * away from carries a close button in its head, while an alertdialog puts its
 * title in the body and makes you answer the question.
 */
export const Modal = ({
    title, titleId, role = 'dialog', dismissible = true, onClose, foot, children,
}) => {
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div className="overlay" onMouseDown={onClose}>
            <div
                className="modal modal-sm"
                role={role}
                aria-modal="true"
                aria-labelledby={titleId}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {dismissible && (
                    <div className="modal-head">
                        <h2 className="modal-title" id={titleId}>{title}</h2>
                        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
                    </div>
                )}
                <div className="modal-body">
                    {!dismissible && <h2 className="modal-title" id={titleId}>{title}</h2>}
                    {children}
                </div>
                <div className="modal-foot">{foot}</div>
            </div>
        </div>
    );
};

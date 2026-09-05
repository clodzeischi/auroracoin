import { useEffect } from 'react';

/**
 * Destructive confirmation. Separate from CoinForm because it is an
 * alertdialog: it interrupts rather than collects.
 */
export const ConfirmDialog = ({ isOpen, title, detail, confirmLabel, onConfirm, onCancel }) => {

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div className="overlay" onMouseDown={onCancel}>
            <div
                className="modal modal-sm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="modal-body">
                    <h2 className="modal-title" id="confirm-title">{title}</h2>
                    {detail && <p className="confirm-detail">{detail}</p>}
                </div>
                <div className="modal-foot">
                    <button className="btn btn-quiet" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-danger" onClick={onConfirm} autoFocus>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

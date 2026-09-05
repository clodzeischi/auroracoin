import { Modal } from './Modal.jsx';

/**
 * Destructive confirmation. An alertdialog rather than a dialog: it interrupts
 * rather than collects, so it offers no close button and has to be answered.
 */
export const ConfirmDialog = ({ isOpen, title, detail, confirmLabel, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <Modal
            title={title}
            titleId="confirm-title"
            role="alertdialog"
            dismissible={false}
            onClose={onCancel}
            foot={
                <>
                    <button className="btn btn-quiet" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-danger" onClick={onConfirm} autoFocus>
                        {confirmLabel}
                    </button>
                </>
            }
        >
            {detail && <p className="confirm-detail">{detail}</p>}
        </Modal>
    );
}

import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal.jsx';

/** A one-field modal, for renaming things. */
export const PromptDialog = ({
    isOpen, title, label, initialValue = '', confirmLabel = 'Save', maxLength = 60,
    onConfirm, onCancel,
}) => {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        setValue(initialValue);
        setError(null);
        inputRef.current?.focus();
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const submit = () => {
        const trimmed = value.trim();
        if (!trimmed) {
            setError('Enter a nickname.');
            return;
        }
        onConfirm(trimmed);
    };

    return (
        <Modal
            title={title}
            titleId="prompt-title"
            onClose={onCancel}
            foot={
                <>
                    <button className="btn btn-quiet" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-primary" onClick={submit}>{confirmLabel}</button>
                </>
            }
        >
            <div className="field">
                <label htmlFor="prompt-input">{label}</label>
                <input
                    ref={inputRef}
                    id="prompt-input"
                    value={value}
                    maxLength={maxLength}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                />
            </div>
            {error && <div role="alert" className="alert">{error}</div>}
        </Modal>
    );
};

import { useEffect, useRef, useState } from 'react';

/** A one-field modal, for renaming things. */
export const PromptDialog = ({
    isOpen, title, label, initialValue = '', confirmLabel = 'Save', maxLength = 60,
    onConfirm, onCancel,
}) => {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return undefined;
        setValue(initialValue);
        setError(null);
        inputRef.current?.focus();
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, initialValue, onCancel]);

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
        <div className="overlay" onMouseDown={onCancel}>
            <div
                className="modal modal-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="prompt-title"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="modal-head">
                    <h2 className="modal-title" id="prompt-title">{title}</h2>
                    <button className="modal-close" onClick={onCancel} aria-label="Close">×</button>
                </div>
                <div className="modal-body">
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
                </div>
                <div className="modal-foot">
                    <button className="btn btn-quiet" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-primary" onClick={submit}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
};

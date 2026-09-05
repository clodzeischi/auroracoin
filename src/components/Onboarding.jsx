import { useState } from 'react';

const PrivacyNotice = ({ children }) => (
    <div className="notice">
        <strong>Use a nickname.</strong> {children} This page is hosted on Google, so
        Google's data policies apply to anything you type here.
    </div>
);

export const Onboarding = ({ family, onCreateFamily, onAddChild, onDone, onCancel }) => {
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const step = family ? 'children' : 'family';
    const [added, setAdded] = useState([]);

    const submit = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError(step === 'family' ? 'Give your family a nickname.' : 'Give this child a nickname.');
            return;
        }

        setBusy(true);
        setError(null);
        try {
            if (step === 'family') {
                await onCreateFamily(trimmed);
            } else {
                await onAddChild(trimmed);
                setAdded((previous) => [...previous, trimmed]);
            }
            setName('');
        } catch {
            setError('Could not save that. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="onboarding">
            {step === 'family' ? (
                <>
                    <p className="eyebrow">Step 1 of 2</p>
                    <h1 className="onboarding-title">Name your family</h1>
                    <PrivacyNotice>
                        Something like “The Aurora House”. Don't enter anything you want
                        to keep private.
                    </PrivacyNotice>

                    <div className="field">
                        <label htmlFor="family-name">Family nickname</label>
                        <input
                            id="family-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={60}
                        />
                    </div>
                </>
            ) : (
                <>
                    <p className="eyebrow">Step 2 of 2</p>
                    <h1 className="onboarding-title">Add your children</h1>
                    <PrivacyNotice>
                        Do <strong>not</strong> enter your child's real name, birthday, or
                        anything else that identifies them. A nickname is all this app
                        ever needs.
                    </PrivacyNotice>

                    {added.length > 0 && (
                        <ul className="added-list" aria-label="Children added">
                            {added.map((child) => <li key={child}>{child}</li>)}
                        </ul>
                    )}

                    <div className="field">
                        <label htmlFor="child-name">Child's nickname</label>
                        <input
                            id="child-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={40}
                        />
                    </div>
                </>
            )}

            {error && <div role="alert" className="alert">{error}</div>}

            <div className="onboarding-actions">
                <button className="btn btn-primary" onClick={submit} disabled={busy}>
                    {busy ? 'Saving…' : step === 'family' ? 'Continue' : 'Add child'}
                </button>
                {step === 'children' && added.length > 0 && (
                    <button className="btn btn-quiet" onClick={onDone}>Done</button>
                )}
                {/* Only offered when there is somewhere to go back to: during
                    first-run there is no family view behind this yet. */}
                {onCancel && added.length === 0 && (
                    <button className="btn btn-quiet" onClick={onCancel}>Back</button>
                )}
            </div>
        </main>
    );
};

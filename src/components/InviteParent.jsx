import { useState } from 'react';

const LOOKS_LIKE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Invites are addressed by email because a person's uid does not exist until
 * they have signed in at least once - which is precisely the case an invite
 * covers.
 */
export const InviteParent = ({ pending = [], onInvite, onCancelInvite }) => {
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [sentTo, setSentTo] = useState(null);

    const submit = async () => {
        const address = email.trim().toLowerCase();
        if (!LOOKS_LIKE_EMAIL.test(address)) {
            setError('Enter the Google account email of the parent you want to add.');
            return;
        }

        setBusy(true);
        setError(null);
        try {
            await onInvite(address);
            setSentTo(address);
            setEmail('');
        } catch {
            setError('Could not send that invite. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="card" aria-label="Invite a parent">
            <div className="card-head">
                <h2 className="card-title">Another parent</h2>
            </div>

            <p className="state" style={{ marginBottom: 14 }}>
                They'll need to sign in with this exact Google account. Both parents can
                add, edit and remove transactions.
            </p>

            <div className="invite-row">
                <div className="field" style={{ flex: 1, minWidth: 0 }}>
                    <label htmlFor="invite-email">Google account email</label>
                    <input
                        id="invite-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <button className="btn btn-primary" onClick={submit} disabled={busy}>
                    {busy ? 'Sending…' : 'Send invite'}
                </button>
            </div>

            {error && <div role="alert" className="alert" style={{ marginTop: 12 }}>{error}</div>}
            {sentTo && !error && (
                <p className="state" style={{ marginTop: 12 }}>Invite sent to {sentTo}.</p>
            )}

            {pending.length > 0 && (
                <ul className="pending-list" aria-label="Pending invites">
                    {pending.map((invite) => (
                        <li key={invite.email}>
                            <span>{invite.email}</span>
                            <button
                                type="button"
                                className="link-btn is-danger"
                                aria-label={`Cancel invite to ${invite.email}`}
                                onClick={() => onCancelInvite(invite.email)}
                            >
                                Cancel
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

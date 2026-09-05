export const AcceptInvite = ({ invite, onAccept, onDecline, busy }) => (
    <main className="onboarding">
        <p className="eyebrow">You've been invited</p>
        <h1 className="onboarding-title">
            {invite.invitedByName ? `${invite.invitedByName} invited you` : 'You have an invitation'}
        </h1>
        <p className="state">
            Accepting adds you as a parent. You'll be able to add, edit and remove
            transactions for every child in this family.
        </p>
        <div className="onboarding-actions">
            <button className="btn btn-primary" onClick={onAccept} disabled={busy}>
                {busy ? 'Joining…' : 'Accept'}
            </button>
            <button className="btn btn-quiet" onClick={onDecline} disabled={busy}>
                Not now
            </button>
        </div>
    </main>
);

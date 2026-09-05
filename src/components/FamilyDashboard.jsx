import { useState } from 'react';
import { ChildSummaryCard } from './ChildSummaryCard.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { PromptDialog } from './PromptDialog.jsx';
import { InviteParent } from './InviteParent.jsx';

export const FamilyDashboard = ({
    family, children, ledgerFor, now,
    onOpenChild, onAddChild, onRenameChild, onDeleteChild,
    pendingInvites, onInvite, onCancelInvite,
}) => {
    const [renaming, setRenaming] = useState(null);
    const [deleting, setDeleting] = useState(null);

    const confirmDelete = async () => {
        const target = deleting;
        setDeleting(null);
        await onDeleteChild(target.id);
    };

    return (
        <main>
            <section className="family-head">
                <h1 className="family-title">{family.name}</h1>
                <p className="family-sub">
                    {children.length === 1 ? '1 account' : `${children.length} accounts`}
                </p>
            </section>

            {children.length === 0 ? (
                <div className="card">
                    <p className="state">No children yet.</p>
                </div>
            ) : (
                <div className="child-grid">
                    {children.map((child) => (
                        <ChildSummaryCard
                            key={child.id}
                            child={child}
                            ledger={ledgerFor(child.id)}
                            now={now}
                            onOpen={() => onOpenChild(child.id)}
                            onRename={() => setRenaming(child)}
                            onDelete={() => setDeleting(child)}
                        />
                    ))}
                </div>
            )}

            <div className="family-actions">
                <button className="btn btn-quiet" onClick={onAddChild}>Add a child</button>
            </div>

            <InviteParent
                pending={pendingInvites}
                onInvite={onInvite}
                onCancelInvite={onCancelInvite}
            />

            <PromptDialog
                isOpen={Boolean(renaming)}
                title="Rename child"
                label="Nickname"
                initialValue={renaming ? renaming.name : ''}
                maxLength={40}
                onConfirm={async (name) => {
                    const target = renaming;
                    setRenaming(null);
                    await onRenameChild(target.id, name);
                }}
                onCancel={() => setRenaming(null)}
            />

            <ConfirmDialog
                isOpen={Boolean(deleting)}
                title={deleting ? `Delete ${deleting.name}'s account?` : ''}
                detail="Their balance and every transaction will be permanently removed. This cannot be undone."
                confirmLabel="Delete account"
                onConfirm={confirmDelete}
                onCancel={() => setDeleting(null)}
            />
        </main>
    );
};

import { ChildSummaryCard } from './ChildSummaryCard.jsx';

export const FamilyDashboard = ({ family, children, ledgerFor, now, onOpenChild, onAddChild }) => (
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
                    />
                ))}
            </div>
        )}

        <div className="family-actions">
            <button className="btn btn-quiet" onClick={onAddChild}>Add a child</button>
        </div>
    </main>
);

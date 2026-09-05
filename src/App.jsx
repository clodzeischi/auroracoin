import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header.jsx";
import { Intro } from "./components/Intro.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { FamilyDashboard } from "./components/FamilyDashboard.jsx";
import { ChildLedger } from "./components/ChildLedger.jsx";
import { MockDataBanner } from "./components/MockDataBanner.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useFamily } from "./hooks/useFamily.js";
import { getBackend } from "./data/index.js";
import { isChild } from "./data/roles.js";

export const App = () => {
    const backend = useMemo(() => getBackend(), []);
    const { user, loading: authLoading, login, logout } = useAuth(backend);
    const { family, children, loading: familyLoading } = useFamily(backend, user);

    const [selectedChildId, setSelectedChildId] = useState(null);
    const [addingChild, setAddingChild] = useState(false);

    // Selecting a child pushes history, so the phone's back gesture returns to
    // the family view instead of leaving the app.
    const openChild = useCallback((childId) => {
        setSelectedChildId(childId);
        window.history.pushState({ childId }, '');
    }, []);

    useEffect(() => {
        const onPopState = () => setSelectedChildId(null);
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const shell = (content) => (
        <>
            <MockDataBanner user={user} />
            <div className="shell">
                <Header user={user} loading={authLoading} login={login} logout={logout} />
                {content}
            </div>
        </>
    );

    if (authLoading) return shell(<p className="state">Loading…</p>);
    if (!user) return shell(<Intro onSignIn={login} />);

    // A paired child device knows exactly one ledger and never leaves it.
    if (isChild(user)) {
        if (!user.familyId || !user.childId) {
            return shell(<p className="state">This device isn't paired yet.</p>);
        }
        return shell(
            <ChildLedger
                child={{ name: user.displayName ?? 'Your' }}
                ledger={backend.ledgerFor(user.familyId, user.childId)}
                user={user}
            />
        );
    }

    if (familyLoading) return shell(<p className="state">Loading…</p>);

    // No family, no children, or explicitly adding one: onboarding.
    if (!family || children.length === 0 || addingChild) {
        return shell(
            <Onboarding
                family={family}
                onCreateFamily={(name) =>
                    backend.createFamily({
                        uid: user.uid,
                        name,
                        email: user.email,
                        displayName: user.displayName,
                    })
                }
                onAddChild={(name) => backend.addChild(family.id, { name })}
                onDone={() => setAddingChild(false)}
            />
        );
    }

    const selectedChild = children.find((child) => child.id === selectedChildId);

    if (selectedChild) {
        return shell(
            <ChildLedger
                child={selectedChild}
                ledger={backend.ledgerFor(family.id, selectedChild.id)}
                user={user}
                onBack={() => window.history.back()}
            />
        );
    }

    return shell(
        <FamilyDashboard
            family={family}
            children={children}
            ledgerFor={(childId) => backend.ledgerFor(family.id, childId)}
            onOpenChild={openChild}
            onAddChild={() => setAddingChild(true)}
        />
    );
}

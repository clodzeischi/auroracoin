import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header.jsx";
import { Intro } from "./components/Intro.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { FamilyDashboard } from "./components/FamilyDashboard.jsx";
import { AcceptInvite } from "./components/AcceptInvite.jsx";
import { ChildLedger } from "./components/ChildLedger.jsx";
import { ChildApp } from "./components/ChildApp.jsx";
import { MockDataBanner } from "./components/MockDataBanner.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useFamily } from "./hooks/useFamily.js";
import { useInvite } from "./hooks/useInvite.js";
import { usePendingInvites } from "./hooks/usePendingInvites.js";
import { useDevices } from "./hooks/useDevices.js";
import { usePairings } from "./hooks/usePairings.js";
import { getBackend } from "./data/index.js";
import { isChild } from "./data/roles.js";

export const App = () => {
    const backend = useMemo(() => getBackend(), []);
    const { user, loading: authLoading, login, logout } = useAuth(backend);

    // A child device is anonymous and belongs to no family in its own right,
    // so it must not open the parent-side subscriptions at all.
    const childSession = isChild(user);
    const { family, children, loading: familyLoading } = useFamily(backend, childSession ? null : user);

    const invite = useInvite(backend, user?.email ?? null);
    const pendingInvites = usePendingInvites(backend, family?.id ?? null);

    const devices = useDevices(backend, family?.id ?? null);
    const pairings = usePairings(backend, family?.id ?? null);

    const [selectedChildId, setSelectedChildId] = useState(null);
    const [addingChild, setAddingChild] = useState(false);
    const [joining, setJoining] = useState(false);
    const [declinedInvite, setDeclinedInvite] = useState(false);

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

    if (!user) {
        return shell(
            <Intro
                onSignIn={login}
                // Reading a pairing code requires being signed in, so setting up
                // a child's device starts with an anonymous session and only
                // then asks for the code.
                onPairDevice={() => backend.startChildSession()}
            />
        );
    }

    // A child's device knows exactly one ledger and never leaves it.
    if (childSession) {
        return shell(<ChildApp backend={backend} user={user} onExit={logout} />);
    }

    if (familyLoading) return shell(<p className="state">Loading…</p>);

    // Someone invited to a family they have not joined yet is offered that
    // before being walked through creating one of their own.
    if (!family && invite && !declinedInvite) {
        return shell(
            <AcceptInvite
                invite={invite}
                busy={joining}
                onAccept={async () => {
                    setJoining(true);
                    try {
                        await backend.acceptInvite(invite.familyId, user);
                    } finally {
                        setJoining(false);
                    }
                }}
                onDecline={() => setDeclinedInvite(true)}
            />
        );
    }

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
                onCancel={addingChild ? () => setAddingChild(false) : undefined}
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
            onRenameChild={(childId, name) => backend.renameChild(family.id, childId, name)}
            onDeleteChild={(childId) => backend.deleteChild(family.id, childId)}
            pendingInvites={pendingInvites}
            onInvite={(email) =>
                backend.inviteParent(family.id, {
                    email,
                    invitedByName: user.displayName ?? user.email,
                })
            }
            onCancelInvite={(email) => backend.cancelInvite(email)}
            devices={devices}
            pairings={pairings}
            onCreatePairingCode={(childId) => backend.createPairingCode(family.id, childId)}
            onCancelPairingCode={(code) => backend.cancelPairingCode(code)}
            onUnpairDevice={(uid) => backend.unpairDevice(uid)}
        />
    );
}

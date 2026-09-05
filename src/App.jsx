import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    const [addingChildren, setAddingChildren] = useState(false);
    const [joining, setJoining] = useState(false);
    const [declinedInvite, setDeclinedInvite] = useState(false);

    /**
     * Both screens reachable from the family view push a history entry, so the
     * phone's back gesture returns there rather than leaving the app - and so
     * the gesture and the on-screen button agree, since both leave by
     * unwinding that entry.
     */
    const openChild = useCallback((childId) => {
        setSelectedChildId(childId);
        window.history.pushState({ childId }, '');
    }, []);

    // A ref rather than the state flag, because this has to settle
    // synchronously: StrictMode runs the effect below twice, and two entries
    // pushed for one screen would take two back gestures to undo.
    const addChildrenEntry = useRef(false);

    const openAddChildren = useCallback(() => {
        if (addChildrenEntry.current) return;
        addChildrenEntry.current = true;
        setAddingChildren(true);
        window.history.pushState({ addingChildren: true }, '');
    }, []);

    // The step belongs to one household: if the family changes under the
    // session, it does not carry over. Declared before the effect that opens
    // it so a new family still lands on the step when it needs to.
    useEffect(() => {
        addChildrenEntry.current = false;
        setAddingChildren(false);
    }, [family?.id]);

    /**
     * A family with no children has nowhere else to be, so the add-children
     * step opens itself. Leaving is deliberate - the Done button - rather than
     * automatic on the first child arriving, which used to throw a parent out
     * of "Add your children" after exactly one, before Done had ever rendered.
     */
    useEffect(() => {
        if (!familyLoading && family && children.length === 0 && !addingChildren) {
            openAddChildren();
        }
    }, [familyLoading, family, children.length, addingChildren, openAddChildren]);

    useEffect(() => {
        // Going back closes whichever of the two is open. If that leaves a
        // family with no children the effect above reopens the step - it
        // depends on `addingChildren`, so closing it is itself what re-runs
        // it - and a parent cannot strand themselves on an empty household.
        const onPopState = () => {
            setSelectedChildId(null);
            addChildrenEntry.current = false;
            setAddingChildren(false);
        };
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

    // No family yet, or the add-children step is open. The children.length
    // term is not what keeps the step open - `addingChildren` does that, which
    // is why adding a child no longer ejects you mid-flow - it just avoids
    // showing an empty dashboard for the frame before the effect reopens it.
    if (!family || addingChildren || children.length === 0) {
        return shell(
            <Onboarding
                family={family}
                childCount={children.length}
                onCreateFamily={(name) =>
                    backend.createFamily({
                        uid: user.uid,
                        name,
                        email: user.email,
                        displayName: user.displayName,
                    })
                }
                onAddChild={(name) => backend.addChild(family.id, { name })}
                onLeave={() => window.history.back()}
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
            onAddChild={openAddChildren}
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

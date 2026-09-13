import {useState} from "react";
import {isChild} from "../data/roles.js";
import {ConfirmDialog} from "./ConfirmDialog.jsx";

export const Header = ({user, loading, login, logout}) => {

    const child = isChild(user);
    // Confirmed rather than immediate: a child's session is anonymous, so
    // signing out cannot be undone by signing back in - Firebase hands the
    // next signInAnonymously() a brand new uid, orphaning this device's
    // devices/{uid} record for good. The parent can still see and unpair the
    // stale entry from their side; this dialog just makes sure that trade is
    // understood before it happens, rather than someone getting stranded on
    // this screen with no way back to a Google sign-in at all.
    const [confirmingSignOut, setConfirmingSignOut] = useState(false);

    return (
        <header className="header">
            <a className="brand" href="/">
                <img alt="" src="/favicon.ico" />
                <span>AuroraCoin</span>
            </a>
            <div className="header-actions">
                {/* While auth is still resolving, render nothing rather than
                    flashing a sign-in button at someone already signed in. */}
                {loading ? null : child ? (
                    <button className="btn btn-quiet" onClick={() => setConfirmingSignOut(true)}>
                        Sign out
                    </button>
                ) : user ? (
                    <button className="btn btn-quiet" onClick={logout}>Sign out</button>
                ) : (
                    <button className="btn btn-quiet" onClick={login}>Sign in with Google</button>
                )}
            </div>

            <ConfirmDialog
                isOpen={confirmingSignOut}
                title="Sign out of this device?"
                detail="This device is paired to a child's account. Signing out ends that pairing for good - a parent will need to pair it again with a new code."
                confirmLabel="Sign out"
                onConfirm={() => {
                    setConfirmingSignOut(false);
                    logout();
                }}
                onCancel={() => setConfirmingSignOut(false)}
            />
        </header>
    )
}

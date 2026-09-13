import {useEffect, useState} from "react";
import {isChild} from "../data/roles.js";
import {ConfirmDialog} from "./ConfirmDialog.jsx";
import {SESSION_CANCELLED} from "../data/session.js";

export const Header = ({user, loading, login, logout, hero = false}) => {

    const child = isChild(user);
    // Confirmed rather than immediate: a child's session is anonymous, so
    // signing out cannot be undone by signing back in - Firebase hands the
    // next signInAnonymously() a brand new uid, orphaning this device's
    // devices/{uid} record for good. The parent can still see and unpair the
    // stale entry from their side; this dialog just makes sure that trade is
    // understood before it happens, rather than someone getting stranded on
    // this screen with no way back to a Google sign-in at all.
    const [confirmingSignOut, setConfirmingSignOut] = useState(false);

    // This is now the only sign-in door - the intro screen's own button moved
    // here - so the busy/error handling it used to do comes with it. Closing
    // the Google popup is a decision, not a failure, so it stays quiet.
    const [signingIn, setSigningIn] = useState(false);
    const [signInError, setSignInError] = useState(null);

    // A successful sign-in swaps the whole screen away from this button, so
    // nothing here ever clears `signingIn` on that path - but the component
    // itself doesn't unmount, so the flag survives into the next signed-out
    // render after a later sign-out and reappears stuck on "Signing in...".
    useEffect(() => {
        if (!user) setSigningIn(false);
    }, [user]);

    const startSignIn = async () => {
        setSigningIn(true);
        setSignInError(null);
        try {
            await login();
            // Success is not handled here: the auth subscription swaps the
            // whole screen, so clearing `signingIn` would only flash the idle
            // button on the way past.
        } catch (failure) {
            if (failure?.reason !== SESSION_CANCELLED) {
                setSignInError('Could not start. Please try again.');
            }
            setSigningIn(false);
        }
    };

    return (
        <header className="header">
            <div className="header-row">
                {/* The full crest on the hero screen already spells out
                    "AuroraCoin" on its own, so no separate wordmark sits next
                    to it there. The compact favicon elsewhere is too small to
                    read as a wordmark, so the title comes back next to it -
                    dropped again below a width where the two can't both fit
                    next to the header's other button (see .brand-title). */}
                <a className={`brand${hero ? ' brand-hero' : ''}`} href="/">
                    <img alt={hero ? 'AuroraCoin' : ''} src={hero ? '/aurora_logo_512.png' : '/icon.png'} />
                    {!hero && <span className="brand-title">AuroraCoin</span>}
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
                        <button className="btn btn-quiet" onClick={startSignIn} disabled={signingIn}>
                            {signingIn ? 'Signing in…' : 'Sign in with Google'}
                        </button>
                    )}
                </div>
            </div>

            {signInError && <div role="alert" className="alert">{signInError}</div>}

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

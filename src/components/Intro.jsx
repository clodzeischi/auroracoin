import { useState } from 'react';
import { CHILD_SESSIONS_DISABLED, SESSION_CANCELLED } from '../data/session.js';

const MESSAGES = {
    // Not something the person holding the device can fix, so it says who can.
    [CHILD_SESSIONS_DISABLED]:
        "Child devices aren't switched on for this app yet. Ask whoever set it up to enable anonymous sign-in.",
};

export const Intro = ({ onSignIn, onPairDevice }) => {
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);

    /**
     * Both doors are a network round trip that can fail. Neither used to say
     * so: the promise was dropped on the floor, so a refused sign-in looked
     * exactly like a button that did nothing at all.
     */
    const start = (door, begin) => async () => {
        setBusy(door);
        setError(null);
        try {
            await begin();
            // Success is not handled here. The auth subscription swaps this
            // whole screen out, so clearing `busy` would only flash the idle
            // button on the way past.
        } catch (failure) {
            // Closing the Google popup is a decision, not a failure.
            if (failure?.reason !== SESSION_CANCELLED) {
                setError(MESSAGES[failure?.reason] ?? 'Could not start. Please try again.');
            }
            setBusy(null);
        }
    };

    return (
        <main className="intro">
            <h1 className="intro-title">A bank account for your kid<br />that you actually hold.</h1>

            <div className="intro-body">
                <p>
                    AuroraCoin is an allowance tracker that works like a virtual bank
                    account. When your child earns money, you add it to their balance.
                    When they want something at a store, you pay with your card and
                    withdraw the amount from their account.
                </p>
                <p>
                    You keep physical control of the money. They get a real balance, a
                    history they can look through, and a sense of how a balance sheet
                    works.
                </p>
            </div>

            <div className="intro-actions">
                <button
                    className="btn btn-primary btn-lg"
                    onClick={start('parent', onSignIn)}
                    disabled={busy !== null}
                >
                    {busy === 'parent' ? 'Signing in…' : 'Sign in with Google'}
                </button>
                <p className="intro-note">
                    New here or coming back — same button. We'll set you up if it's your
                    first time.
                </p>
            </div>

            {error && <div role="alert" className="alert intro-alert">{error}</div>}

            <p className="intro-pair">
                Setting up a child's device?{' '}
                <button
                    type="button"
                    className="link-btn link-inline"
                    onClick={start('child', onPairDevice)}
                    disabled={busy !== null}
                >
                    {busy === 'child' ? 'Starting…' : 'Pair it with a code'}
                </button>
            </p>
        </main>
    );
};

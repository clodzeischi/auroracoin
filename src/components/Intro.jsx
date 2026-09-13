import { useState } from 'react';
import { useTypewriter } from '../hooks/useTypewriter.js';
import { MOOD_IMAGE } from '../data/mascot.js';
import { CHILD_SESSIONS_DISABLED } from '../data/session.js';

/**
 * Aurora's greeting. Mood drives which sprite shows: `talk` settles to
 * `idle` once a line finishes typing and is just waiting on a tap - she's
 * not mid-sentence anymore - while `hi` and `wink` hold their own
 * expression for the whole line. See the mood calculation below.
 */
const LINES = [
    { text: "Hi, welcome to AuroraCoin!", mood: 'hi' },
    { text: "AuroraCoin is a virtual ledger that teaches your kids financial responsibility.", mood: 'talk' },
    { text: "It never touches the actual money. Just a virtual balance sheet to make your life easier.", mood: 'talk' },
    { text: "It's very simple: sign in with Google, create a family profile, and create allowance trackers for your kids.", mood: 'talk' },
    { text: "You can track their allowance, payments for chores, and expenses on toys and the like.", mood: 'talk' },
    { text: "You can generate a code for your kids to see their balance and track their spending without a Google account.", mood: 'talk' },
    { text: "Remember to use nicknames and never input any personal information for your kids or your family!", mood: 'wink' },
];

// Only the pairing door can ever fail this way - a parent's Google sign-in
// lives in Header now, and takes its own copy of this pattern with it.
const MESSAGES = {
    [CHILD_SESSIONS_DISABLED]:
        "Child devices aren't switched on for this app yet. Ask whoever set it up to enable anonymous sign-in.",
};

export const Intro = ({ onPairDevice }) => {
    const [lineIndex, setLineIndex] = useState(0);
    const [pairing, setPairing] = useState(false);
    const [pairError, setPairError] = useState(null);

    const line = LINES[lineIndex];
    const isLastLine = lineIndex === LINES.length - 1;
    const { shown, done, finish } = useTypewriter(line.text);

    const mood = line.mood === 'talk' ? (done ? 'idle' : 'talk') : line.mood;

    // A tap while she's still typing jumps straight to the full line - the
    // JRPG convention - rather than skipping ahead to the next one. Once the
    // line has nothing left to say, further taps do nothing: the closing
    // reminder is meant to just sit there as the resting state.
    const advance = () => {
        if (!done) { finish(); return; }
        if (!isLastLine) setLineIndex((index) => index + 1);
    };

    const startPairing = async () => {
        setPairing(true);
        setPairError(null);
        try {
            await onPairDevice();
            // Reading a pairing code comes next, on its own screen; nothing
            // more to do here once the anonymous session has started.
        } catch (failure) {
            setPairError(MESSAGES[failure?.reason] ?? 'Could not start. Please try again.');
            setPairing(false);
        }
    };

    return (
        <main className="intro">
            {/* A real <button> can't contain block content like the paragraphs
                below - `role="button"` plus manual key handling is the
                standard stand-in. */}
            <div
                className="mascot-scene"
                role="button"
                tabIndex={0}
                aria-label="Continue"
                onClick={advance}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    advance();
                }}
            >
                <div className="mascot-bubble">
                    <p className="mascot-line">
                        {shown}
                        {!done && <span className="mascot-cursor" aria-hidden="true" />}
                    </p>
                    {done && !isLastLine && <p className="mascot-hint">tap/click to continue</p>}
                </div>
                <img className="mascot" src={MOOD_IMAGE[mood]} alt="" />
            </div>

            {pairError && <div role="alert" className="alert intro-alert">{pairError}</div>}

            <p className="intro-pair">
                Setting up a child's device?{' '}
                <button
                    type="button"
                    className="link-btn link-inline"
                    onClick={startPairing}
                    disabled={pairing}
                >
                    {pairing ? 'Starting…' : 'Pair it with a code'}
                </button>
            </p>
        </main>
    );
};

import { useState } from 'react';
import { useTypewriter } from '../hooks/useTypewriter.js';
import { MOOD_IMAGE } from '../data/mascot.js';

// One line per step, in Aurora's own voice - she carries the guidance and
// the nickname/privacy reminder that used to be a separate notice block.
const LINES = {
    family: {
        text: "First, create a nickname for your family. Mine is called House Aurora.",
        mood: 'talk',
    },
    children: {
        text: "Now add your kids. Remember to use nicknames! We should respect all children's privacy!",
        mood: 'wink',
    },
};

export const Onboarding = ({ family, childCount = 0, onCreateFamily, onAddChild, onLeave }) => {
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const step = family ? 'children' : 'family';
    const [added, setAdded] = useState([]);

    const line = LINES[step];
    const { shown, done } = useTypewriter(line.text);
    // `talk` settles to `idle` once the line has finished typing and she's
    // just standing there; `wink` holds for the whole line, same as intro.
    const mood = line.mood === 'talk' ? (done ? 'idle' : 'talk') : line.mood;

    const submit = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError(step === 'family' ? 'Give your family a nickname.' : 'Give this child a nickname.');
            return;
        }

        setBusy(true);
        setError(null);
        try {
            if (step === 'family') {
                await onCreateFamily(trimmed);
            } else {
                await onAddChild(trimmed);
                setAdded((previous) => [...previous, trimmed]);
            }
            setName('');
        } catch {
            setError('Could not save that. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="onboarding">
            <div className="mascot-scene">
                <img className="mascot" src={MOOD_IMAGE[mood]} alt="" />
                <div className="mascot-bubble">
                    <p className="mascot-line">
                        {shown}
                        {!done && <span className="mascot-cursor" aria-hidden="true" />}
                    </p>
                </div>
            </div>

            {step === 'family' ? (
                <div className="field">
                    <label htmlFor="family-name">Family nickname</label>
                    <input
                        id="family-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={60}
                    />
                </div>
            ) : (
                <>
                    {added.length > 0 && (
                        <ul className="added-list" aria-label="Children added">
                            {added.map((child) => <li key={child}>{child}</li>)}
                        </ul>
                    )}

                    <div className="field">
                        <label htmlFor="child-name">Child's nickname</label>
                        <input
                            id="child-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={40}
                        />
                    </div>
                </>
            )}

            {error && <div role="alert" className="alert">{error}</div>}

            <div className="onboarding-actions">
                <button className="btn btn-primary" onClick={submit} disabled={busy}>
                    {busy ? 'Saving…' : step === 'family' ? 'Continue' : 'Add child'}
                </button>
                {/* One way out, offered as soon as there is a family view to
                    go out to. It reads as Done when this visit added somebody
                    and Back when it did not, but both simply leave the step.
                    During first-run there is nothing behind it yet, so no exit
                    appears until a child exists - counting what this visit
                    added as well as what was already there, so the button does
                    not wait on the subscription to come back round. */}
                {step === 'children' && (childCount > 0 || added.length > 0) && (
                    <button className="btn btn-quiet" onClick={onLeave}>
                        {added.length > 0 ? 'Done' : 'Back'}
                    </button>
                )}
            </div>
        </main>
    );
};

import { useState } from 'react';
import {
  PAIRING_CODE_LENGTH,
  PAIRING_EXPIRED,
  PAIRING_UNKNOWN,
  isWellFormedCode,
  normalizePairingCode,
} from '../data/pairing.js';

// A child reads these, so they say what to do next rather than what went wrong.
const MESSAGES = {
  [PAIRING_UNKNOWN]: "That code doesn't work. Ask for a new one.",
  [PAIRING_EXPIRED]: 'That code has expired. Ask for a new one.',
};

/**
 * What an anonymous session sees until it has been paired to a child. The
 * device is already signed in at this point - anonymously - because reading a
 * pairing code at all requires being signed in.
 */
export const PairDevice = ({ onPair, onCancel }) => {
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const submit = async (event) => {
        event.preventDefault();
        const entered = normalizePairingCode(code);

        if (!isWellFormedCode(entered)) {
            setError(`Enter the ${PAIRING_CODE_LENGTH}-character code from the parent's screen.`);
            return;
        }

        setBusy(true);
        setError(null);
        try {
            await onPair(entered);
            // Deliberately no success state: the device record arrives on its
            // own subscription and swaps this whole screen for the ledger.
        } catch (failure) {
            setError(MESSAGES[failure?.reason] ?? 'Could not pair this device. Please try again.');
            setBusy(false);
        }
    };

    return (
        <main className="onboarding">
            <p className="eyebrow">Child's device</p>
            <h1 className="onboarding-title">Pair this device</h1>

            <p className="state">
                Ask a parent to open AuroraCoin, pick your account and tap
                “Pair a device”. They'll read you a {PAIRING_CODE_LENGTH}-character code.
            </p>

            <form onSubmit={submit}>
                <div className="field">
                    <label htmlFor="pairing-code">Pairing code</label>
                    <input
                        id="pairing-code"
                        className="code-input"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        // Upper-cased on the way in so the field always matches
                        // the card the code was read from.
                        autoCapitalize="characters"
                        autoComplete="one-time-code"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={12}
                        aria-describedby="pairing-hint"
                        autoFocus
                    />
                    <p className="field-hint" id="pairing-hint">
                        Upper or lower case, spaces and dashes all work.
                    </p>
                </div>

                {error && <div role="alert" className="alert">{error}</div>}

                <div className="onboarding-actions">
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? 'Pairing…' : 'Pair device'}
                    </button>
                    {onCancel && (
                        <button type="button" className="btn btn-quiet" onClick={onCancel}>
                            Not now
                        </button>
                    )}
                </div>
            </form>
        </main>
    );
};

import { isUsingMockData, getBackend } from '../data/index.js';

// The personas the mock backend can put you in. Identified by name rather than
// by uid so this component never has to import the mock backend itself - the
// one place a view could otherwise learn how the mock identifies anybody.
const PERSONAS = [
  ['parent', 'Parent'],
  ['child', 'Child'],
  // The same persona before it has redeemed a code, so the pairing screen can
  // be walked without signing anything out.
  ['child-unpaired', 'Child (unpaired)'],
];

/**
 * Makes the dev flag impossible to miss, and lets both personas be previewed
 * without a real Google account or a paired device. Renders nothing - and is
 * stripped from the bundle entirely - in a real build.
 */
export const MockDataBanner = ({ user }) => {
    if (!isUsingMockData()) return null;

    const viewAs = (next) => getBackend().loginAs(next);

    return (
        <div role="status" className="banner">
            <span>Mock data — not connected to Firestore</span>
            <span className="banner-personas">
                {PERSONAS.map(([persona, label]) => (
                    <button
                        key={persona}
                        type="button"
                        className={`persona${user?.persona === persona ? ' is-active' : ''}`}
                        onClick={() => viewAs(persona)}
                    >
                        {label}
                    </button>
                ))}
                {/* Clears the seeded household so onboarding can be walked. */}
                <button
                    type="button"
                    className="persona"
                    onClick={() => getBackend().resetForDev({ seed: false })}
                >
                    Fresh start
                </button>
                <button
                    type="button"
                    className="persona"
                    onClick={() => getBackend().resetForDev({ seed: true })}
                >
                    Reseed
                </button>
            </span>
        </div>
    );
}

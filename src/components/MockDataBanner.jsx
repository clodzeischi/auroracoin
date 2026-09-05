import { isUsingMockData, getBackend } from '../data/index.js';
import { roleFor } from '../data/roles.js';

/**
 * Makes the dev flag impossible to miss, and lets both personas be previewed
 * without a real Google account or a paired device. Renders nothing - and is
 * stripped from the bundle entirely - in a real build.
 */
export const MockDataBanner = ({ user }) => {
    if (!isUsingMockData()) return null;

    const role = roleFor(user);
    const viewAs = (next) => getBackend().loginAs(next);

    return (
        <div role="status" className="banner">
            <span>Mock data — not connected to Firestore</span>
            <span className="banner-personas">
                <button
                    type="button"
                    className={`persona${role === 'parent' ? ' is-active' : ''}`}
                    onClick={() => viewAs('parent')}
                >
                    Parent
                </button>
                <button
                    type="button"
                    className={`persona${role === 'child' ? ' is-active' : ''}`}
                    onClick={() => viewAs('child')}
                >
                    Child
                </button>
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

import { isUsingMockData } from '../data/index.js';

/**
 * Makes the dev flag impossible to miss. Renders nothing in a real build.
 */
export const MockDataBanner = () => {
    if (!isUsingMockData()) return null;

    return (
        <div role="status" className="banner">
            Mock data — not connected to Firestore
        </div>
    );
}

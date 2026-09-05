import { shouldUseMockData } from './env.js';
import { createMockBackend } from './mockBackend.js';
import { createFirestoreBackend } from './firestoreBackend.js';

// `import.meta.env.PROD` is replaced with a literal `true` at build time, so in
// a production build this whole expression folds to `false` and the bundler
// drops createMockBackend - and its seed data - from the output entirely.
// The runtime check in shouldUseMockData() still governs dev behaviour.
const USE_MOCK_DATA = !import.meta.env.PROD && shouldUseMockData(import.meta.env);

let backend = null;

export const isUsingMockData = () => USE_MOCK_DATA;

/**
 * The single place the app decides where its data comes from. Components and
 * hooks depend on this interface, never on `firebase/*` directly.
 */
export const getBackend = () => {
  if (!backend) {
    backend = USE_MOCK_DATA ? createMockBackend() : createFirestoreBackend();
  }
  return backend;
};

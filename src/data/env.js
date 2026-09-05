/**
 * Decides whether the app runs against in-memory mock data or real Firestore.
 *
 * Takes `env` as an argument rather than reading `import.meta.env` directly so
 * the decision itself is unit-testable.
 */
export function shouldUseMockData(env) {
  // A deployed build always talks to real Firestore. This is deliberately not
  // overridable: shipping a bundle full of fake balances would be worse than
  // any convenience an override could buy.
  if (env.PROD) return false;

  if (env.VITE_USE_MOCK_DATA === 'true') return true;
  if (env.VITE_USE_MOCK_DATA === 'false') return false;

  // Default while prototyping: mock, so `yarn dev` works with no .env at all.
  return env.DEV === true;
}

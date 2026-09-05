/**
 * Why a session could not be started.
 *
 * Firebase's own error codes stop at the data layer, the same way Firestore
 * details do: the UI words these reasons, and neither backend leaks an SDK
 * code upward. Mirrors the failure taxonomy in pairing.js.
 */
export const CHILD_SESSIONS_DISABLED = 'child-sessions-disabled';
export const SESSION_CANCELLED = 'session-cancelled';
export const SESSION_UNAVAILABLE = 'session-unavailable';

export const sessionFailure = (reason) =>
  Object.assign(new Error(`Could not start a session: ${reason}`), { reason });

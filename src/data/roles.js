export const PARENT = 'parent';
export const CHILD = 'child';

/**
 * Which persona a session gets.
 *
 * Derived from the session itself: a child's device signs in anonymously, a
 * parent signs in with Google. Anonymity is the entire signal, and it is the
 * same one the security rules key on - a child session has no email, so it can
 * satisfy no rule that writes to a ledger. Client and server therefore agree
 * by construction rather than by convention.
 *
 * What a child session may then *see* is a separate question, and is not
 * answered here: that comes from its devices/{uid} record.
 */
export function roleFor(user) {
  if (!user) return null;
  return user.isAnonymous ? CHILD : PARENT;
}

export const isParent = (user) => roleFor(user) === PARENT;
export const isChild = (user) => roleFor(user) === CHILD;

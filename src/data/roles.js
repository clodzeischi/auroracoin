export const PARENT = 'parent';
export const CHILD = 'child';

const KNOWN = [PARENT, CHILD];

/**
 * Which persona a session gets.
 *
 * Today this is derived from the session itself: a paired child device signs
 * in anonymously, a parent signs in with Google. When families land, the
 * authoritative answer moves to families/{fid}/members/{uid}.role - which is
 * why an explicit role on the user object already wins here.
 */
export function roleFor(user) {
  if (!user) return null;
  if (KNOWN.includes(user.role)) return user.role;
  return user.isAnonymous ? CHILD : PARENT;
}

export const isParent = (user) => roleFor(user) === PARENT;
export const isChild = (user) => roleFor(user) === CHILD;

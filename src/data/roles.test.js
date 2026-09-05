import { describe, it, expect } from 'vitest';
import { PARENT, CHILD, roleFor, isParent, isChild } from './roles.js';

describe('roleFor', () => {
  it('has no role for a signed-out visitor', () => {
    expect(roleFor(null)).toBeNull();
    expect(roleFor(undefined)).toBeNull();
  });

  it('treats a Google account as a parent', () => {
    expect(roleFor({ email: 'parent@example.com' })).toBe(PARENT);
  });

  it('treats an anonymous session as a child', () => {
    // A paired device signs in anonymously: no email, no password, nothing
    // identifying. That is the whole child auth story.
    expect(roleFor({ isAnonymous: true })).toBe(CHILD);
  });

  /**
   * The persona is derived, never read off the session object. A mock user
   * carries a `persona` field for the dev banner, and it must not be able to
   * turn an anonymous device into a parent.
   */
  it('ignores any role-shaped field carried on the user', () => {
    expect(roleFor({ isAnonymous: true, role: PARENT, persona: 'parent' })).toBe(CHILD);
    expect(roleFor({ email: 'a@b.com', role: CHILD })).toBe(PARENT);
  });

  it('answers the two questions the UI actually asks', () => {
    const parent = { email: 'a@b.com' };
    const child = { isAnonymous: true };

    expect(isParent(parent)).toBe(true);
    expect(isChild(parent)).toBe(false);
    expect(isParent(child)).toBe(false);
    expect(isChild(child)).toBe(true);
    expect(isParent(null)).toBe(false);
    expect(isChild(null)).toBe(false);
  });
});

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

  it('lets an explicit role win, for when membership documents land', () => {
    // Today role is derived from the session; with families it will be read
    // off families/{fid}/members/{uid}. This is the seam for that.
    expect(roleFor({ email: 'a@b.com', role: CHILD })).toBe(CHILD);
    expect(roleFor({ isAnonymous: true, role: PARENT })).toBe(PARENT);
  });

  it('ignores a role it does not recognise rather than trusting it', () => {
    expect(roleFor({ email: 'a@b.com', role: 'admin' })).toBe(PARENT);
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

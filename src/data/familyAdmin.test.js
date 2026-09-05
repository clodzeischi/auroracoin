import { describe, it, expect, vi } from 'vitest';
import { createMockBackend } from './mockBackend.js';

const PARENT = { uid: 'p1', email: 'parent@example.com', displayName: 'Constantin' };
const OTHER = { uid: 'p2', email: 'deeanna@example.com', displayName: 'Deeanna' };

const withFamily = async () => {
  const backend = createMockBackend({ seed: false });
  const familyId = await backend.createFamily({ ...PARENT, name: 'House' });
  return { backend, familyId };
};

describe('managing children', () => {
  it('renames a child', async () => {
    const { backend, familyId } = await withFamily();
    const childId = await backend.addChild(familyId, { name: 'Sparow' });
    const onChildren = vi.fn();
    backend.subscribeToChildren(familyId, onChildren);

    await backend.renameChild(familyId, childId, 'Sparrow');

    expect(onChildren.mock.lastCall[0][0].name).toBe('Sparrow');
  });

  it('deletes a child', async () => {
    const { backend, familyId } = await withFamily();
    const childId = await backend.addChild(familyId, { name: 'Sparrow' });
    const onChildren = vi.fn();
    backend.subscribeToChildren(familyId, onChildren);

    await backend.deleteChild(familyId, childId);

    expect(onChildren.mock.lastCall[0]).toEqual([]);
  });

  it('takes the child\'s transactions with them', async () => {
    // Firestore does not cascade deletes without server code, so an orphaned
    // subcollection would linger invisibly. The backend deletes them.
    const { backend, familyId } = await withFamily();
    const childId = await backend.addChild(familyId, { name: 'Sparrow' });
    await backend.ledgerFor(familyId, childId).addTransaction({
      amountMinor: 500, comment: '', category: 'chores', user: PARENT.email,
    });

    await backend.deleteChild(familyId, childId);

    const onData = vi.fn();
    backend.ledgerFor(familyId, childId).subscribeToTransactions(onData);
    expect(onData.mock.lastCall[0]).toEqual([]);
  });

  it('leaves other children untouched when one is deleted', async () => {
    const { backend, familyId } = await withFamily();
    const first = await backend.addChild(familyId, { name: 'Sparrow' });
    await backend.addChild(familyId, { name: 'Wren' });
    await backend.ledgerFor(familyId, first).addTransaction({
      amountMinor: 500, comment: '', category: 'chores', user: PARENT.email,
    });

    await backend.deleteChild(familyId, first);

    const onChildren = vi.fn();
    backend.subscribeToChildren(familyId, onChildren);
    expect(onChildren.mock.lastCall[0].map((c) => c.name)).toEqual(['Wren']);
  });
});

describe('inviting a second parent', () => {
  it('has no invite for someone who was never invited', () => {
    const backend = createMockBackend({ seed: false });
    const onInvite = vi.fn();

    backend.subscribeToInvite(OTHER.email, onInvite);

    expect(onInvite).toHaveBeenCalledWith(null);
  });

  it('invites by email, since a uid cannot be known before first sign-in', async () => {
    const { backend, familyId } = await withFamily();
    const onInvite = vi.fn();
    backend.subscribeToInvite(OTHER.email, onInvite);

    await backend.inviteParent(familyId, { email: OTHER.email, invitedByName: 'Constantin' });

    expect(onInvite.mock.lastCall[0]).toMatchObject({
      familyId,
      email: OTHER.email,
      invitedByName: 'Constantin',
    });
  });

  it('matches the invited address case-insensitively', async () => {
    const { backend, familyId } = await withFamily();
    const onInvite = vi.fn();
    backend.subscribeToInvite(OTHER.email, onInvite);

    await backend.inviteParent(familyId, { email: 'Deeanna@Example.com', invitedByName: 'C' });

    expect(onInvite.mock.lastCall[0]).not.toBeNull();
  });

  it('does not leak an invite to anyone else', async () => {
    const { backend, familyId } = await withFamily();
    const onStranger = vi.fn();
    backend.subscribeToInvite('stranger@example.com', onStranger);

    await backend.inviteParent(familyId, { email: OTHER.email, invitedByName: 'C' });

    expect(onStranger.mock.lastCall[0]).toBeNull();
  });

  it('makes the invitee a parent of that family on acceptance', async () => {
    const { backend, familyId } = await withFamily();
    await backend.inviteParent(familyId, { email: OTHER.email, invitedByName: 'C' });
    const onFamily = vi.fn();
    backend.subscribeToFamily(OTHER.uid, onFamily);

    await backend.acceptInvite(familyId, OTHER);

    expect(onFamily.mock.lastCall[0]).toMatchObject({ id: familyId, name: 'House' });
  });

  it('consumes the invite so it cannot be replayed', async () => {
    const { backend, familyId } = await withFamily();
    await backend.inviteParent(familyId, { email: OTHER.email, invitedByName: 'C' });
    const onInvite = vi.fn();
    backend.subscribeToInvite(OTHER.email, onInvite);

    await backend.acceptInvite(familyId, OTHER);

    expect(onInvite.mock.lastCall[0]).toBeNull();
  });

  it('keeps the original parent when a second joins', async () => {
    const { backend, familyId } = await withFamily();
    await backend.inviteParent(familyId, { email: OTHER.email, invitedByName: 'C' });
    await backend.acceptInvite(familyId, OTHER);

    const onFamily = vi.fn();
    backend.subscribeToFamily(PARENT.uid, onFamily);
    expect(onFamily.mock.lastCall[0]).not.toBeNull();
  });

  it('lists pending invites for the family, and drops them when cancelled', async () => {
    const { backend, familyId } = await withFamily();
    const onPending = vi.fn();
    backend.subscribeToPendingInvites(familyId, onPending);

    await backend.inviteParent(familyId, { email: OTHER.email, invitedByName: 'C' });
    expect(onPending.mock.lastCall[0].map((i) => i.email)).toEqual([OTHER.email]);

    await backend.cancelInvite(OTHER.email);
    expect(onPending.mock.lastCall[0]).toEqual([]);
  });
});

describe('dev reset', () => {
  it('clears the seeded household so onboarding can be walked', async () => {
    const backend = createMockBackend();
    const onFamily = vi.fn();
    backend.subscribeToFamily('mock-parent-uid', onFamily);
    expect(onFamily.mock.lastCall[0]).not.toBeNull();

    await backend.resetForDev({ seed: false });

    expect(onFamily.mock.lastCall[0]).toBeNull();
  });

  it('can put the seeded household back', async () => {
    const backend = createMockBackend();
    await backend.resetForDev({ seed: false });
    const onFamily = vi.fn();
    backend.subscribeToFamily('mock-parent-uid', onFamily);

    await backend.resetForDev({ seed: true });

    expect(onFamily.mock.lastCall[0]).not.toBeNull();
  });
});

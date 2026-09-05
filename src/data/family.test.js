import { describe, it, expect, vi } from 'vitest';
import { createMockBackend } from './mockBackend.js';

const PARENT = { uid: 'p1', email: 'parent@example.com', displayName: 'Constantin' };

describe('family lifecycle', () => {
  it('has no family for a parent who has never made one', () => {
    const backend = createMockBackend({ seed: false });
    const onFamily = vi.fn();

    backend.subscribeToFamily(PARENT.uid, onFamily);

    expect(onFamily).toHaveBeenCalledWith(null);
  });

  it('creates a family and reports it to the parent who made it', async () => {
    const backend = createMockBackend({ seed: false });
    const onFamily = vi.fn();
    backend.subscribeToFamily(PARENT.uid, onFamily);

    await backend.createFamily({ ...PARENT, name: 'The Aurora House' });

    expect(onFamily.mock.lastCall[0]).toMatchObject({ name: 'The Aurora House' });
    expect(onFamily.mock.lastCall[0].id).toEqual(expect.any(String));
  });

  it('does not report one parent\'s family to another', async () => {
    const backend = createMockBackend({ seed: false });
    const onOther = vi.fn();
    backend.subscribeToFamily('someone-else', onOther);

    await backend.createFamily({ ...PARENT, name: 'The Aurora House' });

    expect(onOther.mock.lastCall[0]).toBeNull();
  });

  it('starts a new family with no children', async () => {
    const backend = createMockBackend({ seed: false });
    const familyId = await backend.createFamily({ ...PARENT, name: 'House' });
    const onChildren = vi.fn();

    backend.subscribeToChildren(familyId, onChildren);

    expect(onChildren).toHaveBeenCalledWith([]);
  });

  it('adds children and reports them in the order they were created', async () => {
    const backend = createMockBackend({ seed: false });
    const familyId = await backend.createFamily({ ...PARENT, name: 'House' });
    const onChildren = vi.fn();
    backend.subscribeToChildren(familyId, onChildren);

    await backend.addChild(familyId, { name: 'Sparrow' });
    await backend.addChild(familyId, { name: 'Wren' });

    expect(onChildren.mock.lastCall[0].map((c) => c.name)).toEqual(['Sparrow', 'Wren']);
  });

  it('gives each child their own ledger', async () => {
    const backend = createMockBackend({ seed: false });
    const familyId = await backend.createFamily({ ...PARENT, name: 'House' });
    const first = await backend.addChild(familyId, { name: 'Sparrow' });
    const second = await backend.addChild(familyId, { name: 'Wren' });

    await backend.ledgerFor(familyId, first).addTransaction({
      amountMinor: 500, comment: '', category: 'chores', user: PARENT.email,
    });

    const onFirst = vi.fn();
    const onSecond = vi.fn();
    backend.ledgerFor(familyId, first).subscribeToTransactions(onFirst);
    backend.ledgerFor(familyId, second).subscribeToTransactions(onSecond);

    expect(onFirst.mock.lastCall[0]).toHaveLength(1);
    expect(onSecond.mock.lastCall[0]).toHaveLength(0);
  });

  it('exposes a ledger with the same shape components already consume', () => {
    const backend = createMockBackend({ seed: false });
    const ledger = backend.ledgerFor('f', 'c');

    ['subscribeToTransactions', 'addTransaction', 'updateTransaction', 'deleteTransaction']
      .forEach((method) => expect(typeof ledger[method]).toBe('function'));
  });

  it('seeds one family with one child by default, so dev has something to show', () => {
    const backend = createMockBackend();
    const onFamily = vi.fn();
    const onChildren = vi.fn();

    backend.subscribeToFamily('mock-parent-uid', onFamily);
    backend.subscribeToChildren(onFamily.mock.lastCall[0].id, onChildren);

    expect(onFamily.mock.lastCall[0]).not.toBeNull();
    expect(onChildren.mock.lastCall[0].length).toBeGreaterThan(0);
  });
});

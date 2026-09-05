import { describe, it, expect, vi } from 'vitest';
import { createMockBackend } from './mockBackend.js';

describe('createMockBackend', () => {
  it('gives each instance its own state so tests cannot leak into each other', () => {
    const a = createMockBackend();
    const b = createMockBackend();
    a.addTransaction({ amount: 99, comment: 'only in a', user: 'a@example.com' });

    const fromB = vi.fn();
    b.subscribeToTransactions(fromB);
    expect(fromB.mock.lastCall[0].some((t) => t.comment === 'only in a')).toBe(false);
  });

  it('seeds a ledger so a freshly cloned repo has something to render', () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);

    expect(onData.mock.lastCall[0].length).toBeGreaterThan(0);
  });

  it('notifies a new subscriber immediately rather than waiting for a change', () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);

    expect(onData).toHaveBeenCalledTimes(1);
  });

  it('orders transactions newest first, matching the Firestore query', () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);

    const times = onData.mock.lastCall[0].map((t) => t.timestamp.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('seeds every transaction with a valid category so the dashboard has shape', () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);

    const categories = onData.mock.lastCall[0].map((t) => t.category);
    expect(categories.every(Boolean)).toBe(true);
    expect(new Set(categories).size).toBeGreaterThan(1);
  });

  it('seeds both earning and spending so both breakdowns render', () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);

    const amounts = onData.mock.lastCall[0].map((t) => t.amount);
    expect(amounts.some((a) => a > 0)).toBe(true);
    expect(amounts.some((a) => a < 0)).toBe(true);
  });

  it('stores the category on an added transaction', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);

    await backend.addTransaction({
      amount: -6,
      comment: 'lego',
      category: 'toys',
      user: 'parent@example.com',
    });

    expect(onData.mock.lastCall[0][0].category).toBe('toys');
  });

  it('appends a transaction and pushes it to every subscriber', async () => {
    const backend = createMockBackend();
    const first = vi.fn();
    const second = vi.fn();
    backend.subscribeToTransactions(first);
    backend.subscribeToTransactions(second);

    await backend.addTransaction({ amount: 7, comment: 'chores', user: 'kid@example.com' });

    expect(first.mock.lastCall[0][0]).toMatchObject({
      amount: 7,
      comment: 'chores',
      user: 'kid@example.com',
    });
    expect(second.mock.lastCall[0][0].amount).toBe(7);
  });

  it('stamps added transactions with an id and a timestamp, as Firestore would', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);

    await backend.addTransaction({ amount: 1, comment: '', user: 'a@example.com' });
    const added = onData.mock.lastCall[0][0];

    expect(added.id).toEqual(expect.any(String));
    expect(added.timestamp).toBeInstanceOf(Date);
  });

  it('stops notifying after unsubscribe, so unmounted components go quiet', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    const unsubscribe = backend.subscribeToTransactions(onData);
    const callsBefore = onData.mock.calls.length;

    unsubscribe();
    await backend.addTransaction({ amount: 3, comment: '', user: 'a@example.com' });

    expect(onData).toHaveBeenCalledTimes(callsBefore);
  });

  it('updates a transaction in place and notifies subscribers', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);
    const original = onData.mock.lastCall[0][0];

    await backend.updateTransaction(original.id, {
      amount: 99,
      comment: 'corrected',
      category: 'bonus',
      editedBy: 'parent2@example.com',
    });

    const updated = onData.mock.lastCall[0].find((t) => t.id === original.id);
    expect(updated).toMatchObject({ amount: 99, comment: 'corrected', category: 'bonus' });
  });

  it('records who edited a transaction and when', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);
    const original = onData.mock.lastCall[0][0];

    await backend.updateTransaction(original.id, {
      amount: 12,
      comment: '',
      category: 'bonus',
      editedBy: 'parent2@example.com',
    });

    const updated = onData.mock.lastCall[0].find((t) => t.id === original.id);
    expect(updated.editedBy).toBe('parent2@example.com');
    expect(updated.editedAt).toBeInstanceOf(Date);
  });

  it('leaves the original author and date untouched by an edit', async () => {
    // An edit changes what was recorded, never who recorded it or when.
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);
    const original = onData.mock.lastCall[0][0];

    await backend.updateTransaction(original.id, {
      amount: 1,
      comment: '',
      category: 'bonus',
      editedBy: 'parent2@example.com',
    });

    const updated = onData.mock.lastCall[0].find((t) => t.id === original.id);
    expect(updated.user).toBe(original.user);
    expect(updated.timestamp).toEqual(original.timestamp);
  });

  it('deletes a transaction and notifies subscribers', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToTransactions(onData);
    const before = onData.mock.lastCall[0];
    const victim = before[0];

    await backend.deleteTransaction(victim.id);

    const after = onData.mock.lastCall[0];
    expect(after).toHaveLength(before.length - 1);
    expect(after.some((t) => t.id === victim.id)).toBe(false);
  });

  it('starts signed out', () => {
    const backend = createMockBackend();
    const onAuth = vi.fn();
    backend.subscribeToAuth(onAuth);

    expect(onAuth).toHaveBeenCalledWith(null);
  });

  it('signs a fake user in and out', async () => {
    const backend = createMockBackend();
    const onAuth = vi.fn();
    backend.subscribeToAuth(onAuth);

    await backend.login();
    expect(onAuth.mock.lastCall[0]).toMatchObject({ email: expect.any(String) });

    await backend.logout();
    expect(onAuth.mock.lastCall[0]).toBeNull();
  });

  it('stops notifying auth subscribers after unsubscribe', async () => {
    const backend = createMockBackend();
    const onAuth = vi.fn();
    const unsubscribe = backend.subscribeToAuth(onAuth);
    const callsBefore = onAuth.mock.calls.length;

    unsubscribe();
    await backend.login();

    expect(onAuth).toHaveBeenCalledTimes(callsBefore);
  });
});

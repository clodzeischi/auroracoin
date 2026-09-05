import { describe, it, expect, vi } from 'vitest';
import {
  createMockBackend, MOCK_FAMILY_ID, MOCK_CHILD_ID,
  MOCK_PAIRED_DEVICE_UID, MOCK_UNPAIRED_DEVICE_UID,
} from './mockBackend.js';
import { PAIRING_EXPIRED, PAIRING_TTL_MINUTES, PAIRING_UNKNOWN } from './pairing.js';

// The seeded child's ledger - the interface components actually consume.
const ledgerOf = (backend) => backend.ledgerFor(MOCK_FAMILY_ID, MOCK_CHILD_ID);

describe('createMockBackend', () => {
  it('gives each instance its own state so tests cannot leak into each other', () => {
    const a = createMockBackend();
    const b = createMockBackend();
    ledgerOf(a).addTransaction({ amount: 99, comment: 'only in a', user: 'a@example.com' });

    const fromB = vi.fn();
    ledgerOf(b).subscribeToTransactions(fromB);
    expect(fromB.mock.lastCall[0].some((t) => t.comment === 'only in a')).toBe(false);
  });

  it('seeds a ledger so a freshly cloned repo has something to render', () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    ledgerOf(backend).subscribeToTransactions(onData);

    expect(onData.mock.lastCall[0].length).toBeGreaterThan(0);
  });

  it('notifies a new subscriber immediately rather than waiting for a change', () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    ledgerOf(backend).subscribeToTransactions(onData);

    expect(onData).toHaveBeenCalledTimes(1);
  });

  it('orders transactions newest first, matching the Firestore query', () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    ledgerOf(backend).subscribeToTransactions(onData);

    const times = onData.mock.lastCall[0].map((t) => t.timestamp.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('seeds every transaction with a valid category so the dashboard has shape', () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    ledgerOf(backend).subscribeToTransactions(onData);

    const categories = onData.mock.lastCall[0].map((t) => t.category);
    expect(categories.every(Boolean)).toBe(true);
    expect(new Set(categories).size).toBeGreaterThan(1);
  });

  it('seeds both earning and spending so both breakdowns render', () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    ledgerOf(backend).subscribeToTransactions(onData);

    const amounts = onData.mock.lastCall[0].map((t) => t.amountMinor);
    expect(amounts.some((a) => a > 0)).toBe(true);
    expect(amounts.some((a) => a < 0)).toBe(true);
  });

  it('stores the category on an added transaction', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    ledgerOf(backend).subscribeToTransactions(onData);

    await ledgerOf(backend).addTransaction({
      amountMinor: -600,
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
    ledgerOf(backend).subscribeToTransactions(first);
    ledgerOf(backend).subscribeToTransactions(second);

    await ledgerOf(backend).addTransaction({ amountMinor: 700, comment: 'chores', user: 'kid@example.com' });

    expect(first.mock.lastCall[0][0]).toMatchObject({
      amountMinor: 700,
      comment: 'chores',
      user: 'kid@example.com',
    });
    expect(second.mock.lastCall[0][0].amountMinor).toBe(700);
  });

  it('stamps added transactions with an id and a timestamp, as Firestore would', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    ledgerOf(backend).subscribeToTransactions(onData);

    await ledgerOf(backend).addTransaction({ amountMinor: 100, comment: '', user: 'a@example.com' });
    const added = onData.mock.lastCall[0][0];

    expect(added.id).toEqual(expect.any(String));
    expect(added.timestamp).toBeInstanceOf(Date);
  });

  it('stops notifying after unsubscribe, so unmounted components go quiet', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    const unsubscribe = ledgerOf(backend).subscribeToTransactions(onData);
    const callsBefore = onData.mock.calls.length;

    unsubscribe();
    await ledgerOf(backend).addTransaction({ amountMinor: 300, comment: '', user: 'a@example.com' });

    expect(onData).toHaveBeenCalledTimes(callsBefore);
  });

  it('updates a transaction in place and notifies subscribers', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    ledgerOf(backend).subscribeToTransactions(onData);
    const original = onData.mock.lastCall[0][0];

    await ledgerOf(backend).updateTransaction(original.id, {
      amountMinor: 9900,
      comment: 'corrected',
      category: 'bonus',
      editedBy: 'parent2@example.com',
    });

    const updated = onData.mock.lastCall[0].find((t) => t.id === original.id);
    expect(updated).toMatchObject({ amountMinor: 9900, comment: 'corrected', category: 'bonus' });
  });

  it('records who edited a transaction and when', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    ledgerOf(backend).subscribeToTransactions(onData);
    const original = onData.mock.lastCall[0][0];

    await ledgerOf(backend).updateTransaction(original.id, {
      amountMinor: 1200,
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
    ledgerOf(backend).subscribeToTransactions(onData);
    const original = onData.mock.lastCall[0][0];

    await ledgerOf(backend).updateTransaction(original.id, {
      amountMinor: 100,
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
    ledgerOf(backend).subscribeToTransactions(onData);
    const before = onData.mock.lastCall[0];
    const victim = before[0];

    await ledgerOf(backend).deleteTransaction(victim.id);

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

  it('can sign in as either persona, so both can be previewed in dev', async () => {
    const backend = createMockBackend();
    const onAuth = vi.fn();
    backend.subscribeToAuth(onAuth);

    await backend.loginAs('child');
    expect(onAuth.mock.lastCall[0].isAnonymous).toBe(true);

    await backend.loginAs('parent');
    expect(onAuth.mock.lastCall[0].email).toEqual(expect.any(String));
    expect(onAuth.mock.lastCall[0].isAnonymous).toBeUndefined();
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

describe('ledger handle caching', () => {
  // Mirrors firestoreBackend: components key their subscription effect on the
  // ledger's identity, so it has to be stable across renders.
  it('returns the same handle for the same child', () => {
    const backend = createMockBackend();
    expect(ledgerOf(backend)).toBe(ledgerOf(backend));
  });

  it('keeps different children on different handles', () => {
    const backend = createMockBackend();
    expect(backend.ledgerFor(MOCK_FAMILY_ID, 'a')).not.toBe(backend.ledgerFor(MOCK_FAMILY_ID, 'b'));
  });
});

describe('pairing a child device', () => {
  it('seeds a device already paired, so the child persona has something to show', () => {
    const onData = vi.fn();
    createMockBackend().subscribeToDevice(MOCK_PAIRED_DEVICE_UID, onData);

    expect(onData.mock.lastCall[0]).toMatchObject({
      familyId: MOCK_FAMILY_ID,
      childId: MOCK_CHILD_ID,
    });
  });

  it('leaves the second device unpaired, so the pairing screen can be walked', () => {
    const onData = vi.fn();
    createMockBackend().subscribeToDevice(MOCK_UNPAIRED_DEVICE_UID, onData);

    expect(onData.mock.lastCall[0]).toBeNull();
  });

  it('lists a new code as outstanding for the family', async () => {
    const backend = createMockBackend();
    const onData = vi.fn();
    backend.subscribeToPairings(MOCK_FAMILY_ID, onData);

    const code = await backend.createPairingCode(MOCK_FAMILY_ID, MOCK_CHILD_ID);

    expect(onData.mock.lastCall[0]).toEqual([
      expect.objectContaining({ code, childId: MOCK_CHILD_ID }),
    ]);
  });

  it('pairs the device to the child the code named', async () => {
    const backend = createMockBackend();
    const onDevice = vi.fn();
    backend.subscribeToDevice(MOCK_UNPAIRED_DEVICE_UID, onDevice);

    const code = await backend.createPairingCode(MOCK_FAMILY_ID, 'mock-child-2');
    await backend.redeemPairingCode(code, MOCK_UNPAIRED_DEVICE_UID);

    expect(onDevice.mock.lastCall[0]).toMatchObject({
      familyId: MOCK_FAMILY_ID,
      childId: 'mock-child-2',
    });
  });

  it('spends the code, so the same one cannot pair a second device', async () => {
    const backend = createMockBackend();
    const code = await backend.createPairingCode(MOCK_FAMILY_ID, MOCK_CHILD_ID);
    await backend.redeemPairingCode(code, MOCK_UNPAIRED_DEVICE_UID);

    await expect(backend.redeemPairingCode(code, 'another-device'))
      .rejects.toMatchObject({ reason: PAIRING_UNKNOWN });
  });

  it('accepts a code typed in lower case with the spaces people read out', async () => {
    const backend = createMockBackend();
    const code = await backend.createPairingCode(MOCK_FAMILY_ID, MOCK_CHILD_ID);

    await expect(
      backend.redeemPairingCode(` ${code.toLowerCase()} `, MOCK_UNPAIRED_DEVICE_UID)
    ).resolves.toBeUndefined();
  });

  it('refuses a code nobody made', async () => {
    await expect(createMockBackend().redeemPairingCode('ZZZ999', 'device'))
      .rejects.toMatchObject({ reason: PAIRING_UNKNOWN });
  });

  it('refuses a code once its window has passed', async () => {
    vi.useFakeTimers();
    try {
      const backend = createMockBackend();
      const code = await backend.createPairingCode(MOCK_FAMILY_ID, MOCK_CHILD_ID);
      vi.advanceTimersByTime((PAIRING_TTL_MINUTES + 1) * 60 * 1000);

      await expect(backend.redeemPairingCode(code, 'device'))
        .rejects.toMatchObject({ reason: PAIRING_EXPIRED });
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets a parent revoke a device that is already paired', async () => {
    const backend = createMockBackend();
    const onDevice = vi.fn();
    backend.subscribeToDevice(MOCK_PAIRED_DEVICE_UID, onDevice);

    await backend.unpairDevice(MOCK_PAIRED_DEVICE_UID);

    expect(onDevice.mock.lastCall[0]).toBeNull();
  });

  /**
   * Firestore cascades nothing, so a device left pointing at a deleted child
   * would sit on a ledger that no longer exists - and would keep the family
   * document readable to it.
   */
  it('unpairs devices belonging to a child that is deleted', async () => {
    const backend = createMockBackend();
    const onDevice = vi.fn();
    backend.subscribeToDevice(MOCK_PAIRED_DEVICE_UID, onDevice);

    await backend.deleteChild(MOCK_FAMILY_ID, MOCK_CHILD_ID);

    expect(onDevice.mock.lastCall[0]).toBeNull();
  });

  it('leaves a sibling\'s device alone when one child is deleted', async () => {
    const backend = createMockBackend();
    const onDevice = vi.fn();
    backend.subscribeToDevice(MOCK_PAIRED_DEVICE_UID, onDevice);

    await backend.deleteChild(MOCK_FAMILY_ID, 'mock-child-2');

    expect(onDevice.mock.lastCall[0]).not.toBeNull();
  });
});

describe('deleting a child cleans up after it', () => {
  it('leaves no unredeemed code that could still pair a device to it', async () => {
    const backend = createMockBackend();
    const onPairings = vi.fn();
    backend.subscribeToPairings(MOCK_FAMILY_ID, onPairings);
    const code = await backend.createPairingCode(MOCK_FAMILY_ID, MOCK_CHILD_ID);

    await backend.deleteChild(MOCK_FAMILY_ID, MOCK_CHILD_ID);

    expect(onPairings.mock.lastCall[0]).toEqual([]);
    await expect(backend.redeemPairingCode(code, 'device'))
      .rejects.toMatchObject({ reason: PAIRING_UNKNOWN });
  });

  it("keeps a sibling's outstanding code", async () => {
    const backend = createMockBackend();
    const onPairings = vi.fn();
    backend.subscribeToPairings(MOCK_FAMILY_ID, onPairings);
    const code = await backend.createPairingCode(MOCK_FAMILY_ID, 'mock-child-2');

    await backend.deleteChild(MOCK_FAMILY_ID, MOCK_CHILD_ID);

    expect(onPairings.mock.lastCall[0]).toEqual([expect.objectContaining({ code })]);
  });
});

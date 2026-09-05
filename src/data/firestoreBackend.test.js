import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Every Firebase surface is mocked: these tests assert the adapter's contract
// (paths, query shape, document mapping) without a network or an SDK.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...segments) => ({ __collection: segments.join('/') })),
  doc: vi.fn((...args) => ({ __doc: args.slice(1).join('/'), id: 'generated-id' })),
  query: vi.fn((coll, ...constraints) => ({ __query: coll, constraints })),
  orderBy: vi.fn((field, direction) => ({ __orderBy: field, direction })),
  onSnapshot: vi.fn(() => vi.fn()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc' })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  where: vi.fn((field, op, value) => ({ __where: `${field} ${op} ${value}` })),
  serverTimestamp: vi.fn(() => '__SERVER_TIMESTAMP__'),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  arrayUnion: vi.fn((...values) => ({ __arrayUnion: values })),
  writeBatch: vi.fn(() => ({
    set: vi.fn(), update: vi.fn(), delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  Timestamp: { fromDate: vi.fn((date) => ({ __timestamp: date.getTime() })) },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithPopup: vi.fn(() => Promise.resolve()),
  signInAnonymously: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
}));

vi.mock('./firebaseApp.js', () => ({
  getDb: vi.fn(() => ({ __db: true })),
  getAuthInstance: vi.fn(() => ({ __auth: true })),
  getProvider: vi.fn(() => ({ __provider: true })),
}));

import {
  collection, doc, orderBy, onSnapshot, addDoc,
  updateDoc, deleteDoc, setDoc, where, serverTimestamp,
  getDoc, getDocs, writeBatch, Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signInAnonymously, signOut } from 'firebase/auth';
import { createFirestoreBackend } from './firestoreBackend.js';
import { PAIRING_EXPIRED, PAIRING_TTL_MINUTES, PAIRING_UNKNOWN } from './pairing.js';

const FAMILY = 'fam1';
const CHILD = 'kid1';
const ledger = () => createFirestoreBackend().ledgerFor(FAMILY, CHILD);

const snapshotOf = (docs) => ({ docs });
const firestoreDoc = (id, data) => ({ id, data: () => data });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('transaction ledger', () => {
  it('reads from the child\'s own transactions subcollection, newest first', () => {
    ledger().subscribeToTransactions(vi.fn(), vi.fn());

    expect(collection).toHaveBeenCalledWith(
      expect.anything(), 'families', FAMILY, 'children', CHILD, 'transactions'
    );
    expect(orderBy).toHaveBeenCalledWith('timestamp', 'desc');
  });

  it('maps documents to a backend-agnostic shape, keyed by document id', () => {
    const onData = vi.fn();
    ledger().subscribeToTransactions(onData, vi.fn());

    onSnapshot.mock.calls[0][1](
      snapshotOf([
        firestoreDoc('abc123', {
          amountMinor: 550,
          comment: 'tidied her room',
          category: 'chores',
          user: 'parent@example.com',
          userName: 'Constantin',
          timestamp: { toDate: () => new Date('2026-01-01T00:00:00Z') },
        }),
      ])
    );

    expect(onData).toHaveBeenCalledWith([
      {
        id: 'abc123',
        amountMinor: 550,
        comment: 'tidied her room',
        category: 'chores',
        user: 'parent@example.com',
        userName: 'Constantin',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        editedBy: null,
        editedByName: null,
        editedAt: null,
      },
    ]);
  });

  it('reads a pre-decimal document as whole coins', () => {
    // Written before money became decimal: `amount: 10` meant ten coins, so
    // it must read back as 1000 hundredths, not 10.
    const onData = vi.fn();
    ledger().subscribeToTransactions(onData, vi.fn());

    onSnapshot.mock.calls[0][1](snapshotOf([firestoreDoc('old', { amount: 10, timestamp: null })]));

    expect(onData.mock.lastCall[0][0].amountMinor).toBe(1000);
  });

  it('prefers the new field when a document somehow carries both', () => {
    const onData = vi.fn();
    ledger().subscribeToTransactions(onData, vi.fn());

    onSnapshot.mock.calls[0][1](
      snapshotOf([firestoreDoc('both', { amount: 10, amountMinor: 250, timestamp: null })])
    );

    expect(onData.mock.lastCall[0][0].amountMinor).toBe(250);
  });

  it('defaults a document written before categories existed to uncategorized', () => {
    const onData = vi.fn();
    ledger().subscribeToTransactions(onData, vi.fn());

    onSnapshot.mock.calls[0][1](snapshotOf([firestoreDoc('legacy', { amountMinor: 500, timestamp: null })]));

    expect(onData.mock.lastCall[0][0].category).toBe('uncategorized');
  });

  it('tolerates a null timestamp on a not-yet-committed server write', () => {
    const onData = vi.fn();
    ledger().subscribeToTransactions(onData, vi.fn());

    onSnapshot.mock.calls[0][1](snapshotOf([firestoreDoc('pending', { amountMinor: 100, timestamp: null })]));

    expect(onData.mock.lastCall[0][0].timestamp).toBeNull();
  });

  it('forwards subscription errors to the caller instead of swallowing them', () => {
    const onError = vi.fn();
    ledger().subscribeToTransactions(vi.fn(), onError);

    expect(onSnapshot.mock.calls[0][2]).toBe(onError);
  });

  it('writes a transaction with a server-generated timestamp', async () => {
    await ledger().addTransaction({
      amountMinor: 1250,
      comment: 'birthday',
      category: 'gift',
      user: 'parent@example.com',
      userName: 'Constantin',
    });

    expect(serverTimestamp).toHaveBeenCalled();
    expect(addDoc).toHaveBeenCalledWith(expect.anything(), {
      amountMinor: 1250,
      comment: 'birthday',
      category: 'gift',
      user: 'parent@example.com',
      userName: 'Constantin',
      timestamp: '__SERVER_TIMESTAMP__',
    });
  });

  it('updates only the editable fields, stamping the editor server-side', async () => {
    // user and timestamp are absent on purpose: the rules pin them to their
    // existing values, so sending them would be rejected.
    await ledger().updateTransaction('abc123', {
      amountMinor: 725,
      comment: 'fixed',
      category: 'chores',
      editedBy: 'parent2@example.com',
      editedByName: 'Deeanna',
    });

    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      amountMinor: 725,
      comment: 'fixed',
      category: 'chores',
      editedBy: 'parent2@example.com',
      editedByName: 'Deeanna',
      editedAt: '__SERVER_TIMESTAMP__',
    });
  });

  it('deletes within the child\'s own subcollection', async () => {
    await ledger().deleteTransaction('abc123');

    expect(doc).toHaveBeenCalledWith(
      expect.anything(), 'families', FAMILY, 'children', CHILD, 'transactions', 'abc123'
    );
    expect(deleteDoc).toHaveBeenCalled();
  });
});

describe('family', () => {
  it('finds a family by membership rather than a separate index', () => {
    createFirestoreBackend().subscribeToFamily('uid1', vi.fn(), vi.fn());

    expect(where).toHaveBeenCalledWith('parentUids', 'array-contains', 'uid1');
  });

  it('reports no family when the parent belongs to none', () => {
    const onData = vi.fn();
    createFirestoreBackend().subscribeToFamily('uid1', onData, vi.fn());

    onSnapshot.mock.calls[0][1](snapshotOf([]));

    expect(onData).toHaveBeenCalledWith(null);
  });

  it('reports the family a parent belongs to', () => {
    const onData = vi.fn();
    createFirestoreBackend().subscribeToFamily('uid1', onData, vi.fn());

    onSnapshot.mock.calls[0][1](snapshotOf([firestoreDoc('fam1', { name: 'House' })]));

    expect(onData).toHaveBeenCalledWith({ id: 'fam1', name: 'House' });
  });

  it('creates a family with the founder as its only parent', async () => {
    await createFirestoreBackend().createFamily({
      uid: 'uid1', name: 'House', email: 'p@example.com', displayName: 'Constantin',
    });

    expect(setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      name: 'House',
      createdBy: 'uid1',
      parentUids: ['uid1'],
      parents: { uid1: { email: 'p@example.com', displayName: 'Constantin' } },
    }));
  });

  it('adds a child under the family and returns its id', async () => {
    const id = await createFirestoreBackend().addChild('fam1', { name: 'Sparrow' });

    expect(collection).toHaveBeenCalledWith(expect.anything(), 'families', 'fam1', 'children');
    expect(id).toBe('new-doc');
  });

  it('lists children oldest first, so the order does not shuffle', () => {
    const onData = vi.fn();
    createFirestoreBackend().subscribeToChildren('fam1', onData, vi.fn());

    expect(orderBy).toHaveBeenCalledWith('createdAt', 'asc');

    onSnapshot.mock.calls[0][1](
      snapshotOf([firestoreDoc('c1', { name: 'Sparrow' }), firestoreDoc('c2', { name: 'Wren' })])
    );

    expect(onData).toHaveBeenCalledWith([
      { id: 'c1', name: 'Sparrow' },
      { id: 'c2', name: 'Wren' },
    ]);
  });
});

describe('auth', () => {
  it('delegates to the Firebase SDK', async () => {
    const backend = createFirestoreBackend();
    backend.subscribeToAuth(vi.fn());
    await backend.login();
    await backend.logout();

    expect(onAuthStateChanged).toHaveBeenCalled();
    expect(signInWithPopup).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });
});

describe('ledger handle caching', () => {
  /**
   * Components subscribe in an effect keyed on the ledger's identity. A fresh
   * object per call meant every render of an ancestor - opening a dialog, a
   * pending-invite snapshot arriving - tore down and re-established one
   * Firestore listener per child, re-reading the collection each time.
   */
  it('returns the same handle for the same child', () => {
    const backend = createFirestoreBackend();
    expect(backend.ledgerFor(FAMILY, CHILD)).toBe(backend.ledgerFor(FAMILY, CHILD));
  });

  it('keeps different children on different handles', () => {
    const backend = createFirestoreBackend();
    expect(backend.ledgerFor(FAMILY, 'kid1')).not.toBe(backend.ledgerFor(FAMILY, 'kid2'));
  });

  it('does not share handles between families that reuse a child id', () => {
    const backend = createFirestoreBackend();
    expect(backend.ledgerFor('famA', CHILD)).not.toBe(backend.ledgerFor('famB', CHILD));
  });
});

describe('finding the family', () => {
  const familyDoc = (id) => ({ id, data: () => ({ name: id }) });

  it('picks the same family every load when a parent is in more than one', () => {
    const backend = createFirestoreBackend();
    const onData = vi.fn();
    backend.subscribeToFamily('uid1', onData, vi.fn());
    const emit = onSnapshot.mock.calls[0][1];

    // Snapshot order is not guaranteed, so the same set arriving in a
    // different order must still resolve to the same household.
    emit(snapshotOf([familyDoc('zeta'), familyDoc('alpha')]));
    emit(snapshotOf([familyDoc('alpha'), familyDoc('zeta')]));

    expect(onData.mock.calls.map(([family]) => family.id)).toEqual(['alpha', 'alpha']);
  });

  it('reports no family rather than undefined when there are none', () => {
    const backend = createFirestoreBackend();
    const onData = vi.fn();
    backend.subscribeToFamily('uid1', onData, vi.fn());
    onSnapshot.mock.calls[0][1](snapshotOf([]));

    expect(onData).toHaveBeenCalledWith(null);
  });
});

describe('pairing a child device', () => {
  it('signs a child device in anonymously, so it never carries an email', async () => {
    await createFirestoreBackend().startChildSession();
    expect(signInAnonymously).toHaveBeenCalled();
  });

  it('writes the code as the document id, so a collision is refused not merged', async () => {
    const backend = createFirestoreBackend();
    const code = await backend.createPairingCode(FAMILY, CHILD);

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'pairings', code);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ familyId: FAMILY, childId: CHILD, createdAt: '__SERVER_TIMESTAMP__' })
    );
  });

  it('stamps the code with the advertised expiry', async () => {
    // Bracketed by both clock readings: the expiry is measured from whenever
    // inside the call the code was made, so the only sound assertion is that
    // it lands TTL ahead of some instant during it.
    const before = Date.now();
    await createFirestoreBackend().createPairingCode(FAMILY, CHILD);
    const after = Date.now();

    const ttl = PAIRING_TTL_MINUTES * 60 * 1000;
    const [expiry] = Timestamp.fromDate.mock.calls[0];
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + ttl);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + ttl);
  });

  it('tells a child a code is unknown rather than failing opaquely', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(createFirestoreBackend().redeemPairingCode('ABC234', 'device-1'))
      .rejects.toMatchObject({ reason: PAIRING_UNKNOWN });
  });

  it('tells a child a code has expired, which reads differently from a wrong one', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        familyId: FAMILY,
        childId: CHILD,
        expiresAt: { toMillis: () => Date.now() - 1000 },
      }),
    });
    await expect(createFirestoreBackend().redeemPairingCode('ABC234', 'device-1'))
      .rejects.toMatchObject({ reason: PAIRING_EXPIRED });
  });

  it('claims the device and destroys the code in one batch, so a code is single use', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        familyId: FAMILY,
        childId: CHILD,
        expiresAt: { toMillis: () => Date.now() + 60000 },
      }),
    });

    await createFirestoreBackend().redeemPairingCode('abc-234', 'device-1');

    const batch = writeBatch.mock.results[0].value;
    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        familyId: FAMILY,
        childId: CHILD,
        // Normalized on the way in, so what the child typed matches the id
        // the rules will look the pairing up under.
        code: 'ABC234',
        pairedAt: '__SERVER_TIMESTAMP__',
      })
    );
    expect(batch.delete).toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalled();
  });

  it('reads a device document as null when the device has never paired', () => {
    const onData = vi.fn();
    createFirestoreBackend().subscribeToDevice('device-1', onData, vi.fn());
    onSnapshot.mock.calls[0][1]({ exists: () => false });

    expect(onData).toHaveBeenCalledWith(null);
  });

  it('scopes the device list to one family', () => {
    createFirestoreBackend().subscribeToDevices(FAMILY, vi.fn(), vi.fn());
    expect(where).toHaveBeenCalledWith('familyId', '==', FAMILY);
  });
});

describe('deleting a child', () => {
  // These tests drive getDocs per case; put the shared default back afterwards
  // so nothing leaks into a later file.
  afterEach(() => getDocs.mockImplementation(() => Promise.resolve({ docs: [] })));

  const ref = (path) => ({ __ref: path });
  const docsOf = (...paths) => ({ docs: paths.map((path) => ({ ref: ref(path) })) });

  /**
   * Firestore cascades nothing, so everything that points at a child has to be
   * removed by hand: its ledger, the devices paired to it, and any code that
   * could still pair a new one.
   */
  it('removes the ledger, the devices and the unredeemed codes together', async () => {
    getDocs
      .mockResolvedValueOnce(docsOf('tx-1', 'tx-2'))
      .mockResolvedValueOnce(docsOf('device-1'))
      .mockResolvedValueOnce(docsOf('pairing-1'));

    await createFirestoreBackend().deleteChild(FAMILY, CHILD);

    const batch = writeBatch.mock.results[0].value;
    const deleted = batch.delete.mock.calls.map(([target]) => target);
    expect(deleted).toEqual(expect.arrayContaining([
      ref('tx-1'), ref('tx-2'), ref('device-1'), ref('pairing-1'),
    ]));
    expect(batch.commit).toHaveBeenCalled();
  });

  it('deletes the child document last, so nothing is orphaned by a failure', async () => {
    getDocs
      .mockResolvedValueOnce(docsOf('tx-1'))
      .mockResolvedValueOnce(docsOf())
      .mockResolvedValueOnce(docsOf());

    await createFirestoreBackend().deleteChild(FAMILY, CHILD);

    const batch = writeBatch.mock.results[0].value;
    const last = batch.delete.mock.calls.at(-1)[0];
    expect(last).toEqual(expect.objectContaining({ __doc: `families/${FAMILY}/children/${CHILD}` }));
  });

  it('asks only for the devices and codes of the child being deleted', async () => {
    getDocs.mockResolvedValue(docsOf());

    await createFirestoreBackend().deleteChild(FAMILY, CHILD);

    expect(where).toHaveBeenCalledWith('childId', '==', CHILD);
  });

  it('issues its three reads together rather than one round trip each', async () => {
    let settled = 0;
    getDocs.mockImplementation(() => {
      // Resolves only once all three have been requested, so a sequential
      // implementation would deadlock this test rather than pass it slowly.
      settled += 1;
      return settled === 3 ? Promise.resolve(docsOf()) : new Promise((resolve) => {
        setTimeout(() => resolve(docsOf()), 0);
      });
    });

    await createFirestoreBackend().deleteChild(FAMILY, CHILD);
    expect(settled).toBe(3);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithPopup: vi.fn(() => Promise.resolve()),
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
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { createFirestoreBackend } from './firestoreBackend.js';

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

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Every Firebase surface is mocked: these tests assert the adapter's contract
// (collection names, query shape, document mapping) without a network or an SDK.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ __collection: name })),
  query: vi.fn((coll, ...constraints) => ({ __query: coll, constraints })),
  orderBy: vi.fn((field, direction) => ({ __orderBy: field, direction })),
  onSnapshot: vi.fn(() => vi.fn()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc' })),
  doc: vi.fn((_db, name, id) => ({ __doc: `${name}/${id}` })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
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
  collection, query, orderBy, onSnapshot, addDoc,
  doc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { createFirestoreBackend } from './firestoreBackend.js';

const snapshotOf = (docs) => ({ docs });
const firestoreDoc = (id, data) => ({ id, data: () => data });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createFirestoreBackend', () => {
  it('reads from the transactions collection, newest first', () => {
    createFirestoreBackend().subscribeToTransactions(vi.fn(), vi.fn());

    expect(collection).toHaveBeenCalledWith(expect.anything(), 'transactions');
    expect(orderBy).toHaveBeenCalledWith('timestamp', 'desc');
    expect(query).toHaveBeenCalled();
    expect(onSnapshot).toHaveBeenCalled();
  });

  it('maps documents to a backend-agnostic shape, keyed by document id', () => {
    const onData = vi.fn();
    createFirestoreBackend().subscribeToTransactions(onData, vi.fn());

    const handleSnapshot = onSnapshot.mock.calls[0][1];
    handleSnapshot(
      snapshotOf([
        firestoreDoc('abc123', {
          amount: 5,
          comment: 'tidied her room',
          category: 'chores',
          user: 'parent@example.com',
          timestamp: { toDate: () => new Date('2026-01-01T00:00:00Z') },
        }),
      ])
    );

    expect(onData).toHaveBeenCalledWith([
      {
        id: 'abc123',
        amount: 5,
        comment: 'tidied her room',
        category: 'chores',
        user: 'parent@example.com',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        editedBy: null,
        editedAt: null,
      },
    ]);
  });

  it('defaults a document written before categories existed to uncategorized', () => {
    const onData = vi.fn();
    createFirestoreBackend().subscribeToTransactions(onData, vi.fn());

    const handleSnapshot = onSnapshot.mock.calls[0][1];
    handleSnapshot(snapshotOf([firestoreDoc('legacy', { amount: 5, timestamp: null })]));

    expect(onData.mock.lastCall[0][0].category).toBe('uncategorized');
  });

  it('tolerates a null timestamp on a not-yet-committed server write', () => {
    const onData = vi.fn();
    createFirestoreBackend().subscribeToTransactions(onData, vi.fn());

    const handleSnapshot = onSnapshot.mock.calls[0][1];
    handleSnapshot(snapshotOf([firestoreDoc('pending', { amount: 1, timestamp: null })]));

    expect(onData.mock.lastCall[0][0].timestamp).toBeNull();
  });

  it('forwards subscription errors to the caller instead of swallowing them', () => {
    const onError = vi.fn();
    createFirestoreBackend().subscribeToTransactions(vi.fn(), onError);

    expect(onSnapshot.mock.calls[0][2]).toBe(onError);
  });

  it('writes a transaction with a server-generated timestamp', async () => {
    await createFirestoreBackend().addTransaction({
      amount: 12,
      comment: 'birthday',
      category: 'gift',
      user: 'parent@example.com',
    });

    expect(serverTimestamp).toHaveBeenCalled();
    expect(addDoc).toHaveBeenCalledWith(expect.anything(), {
      amount: 12,
      comment: 'birthday',
      category: 'gift',
      user: 'parent@example.com',
      timestamp: '__SERVER_TIMESTAMP__',
    });
  });

  it('reads edit metadata back off a document', () => {
    const onData = vi.fn();
    createFirestoreBackend().subscribeToTransactions(onData, vi.fn());

    const handleSnapshot = onSnapshot.mock.calls[0][1];
    handleSnapshot(
      snapshotOf([
        firestoreDoc('edited', {
          amount: 5,
          timestamp: null,
          editedBy: 'parent2@example.com',
          editedAt: { toDate: () => new Date('2026-09-03T00:00:00Z') },
        }),
      ])
    );

    const mapped = onData.mock.lastCall[0][0];
    expect(mapped.editedBy).toBe('parent2@example.com');
    expect(mapped.editedAt).toEqual(new Date('2026-09-03T00:00:00Z'));
  });

  it('leaves edit metadata null on a transaction never edited', () => {
    const onData = vi.fn();
    createFirestoreBackend().subscribeToTransactions(onData, vi.fn());

    const handleSnapshot = onSnapshot.mock.calls[0][1];
    handleSnapshot(snapshotOf([firestoreDoc('fresh', { amount: 5, timestamp: null })]));

    expect(onData.mock.lastCall[0][0].editedBy).toBeNull();
    expect(onData.mock.lastCall[0][0].editedAt).toBeNull();
  });

  it('updates only the editable fields, stamping the editor server-side', async () => {
    // user and timestamp are absent on purpose: the rules pin them to their
    // existing values, so sending them would be rejected.
    await createFirestoreBackend().updateTransaction('abc123', {
      amount: 7,
      comment: 'fixed',
      category: 'chores',
      editedBy: 'parent2@example.com',
    });

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'transactions', 'abc123');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      amount: 7,
      comment: 'fixed',
      category: 'chores',
      editedBy: 'parent2@example.com',
      editedAt: '__SERVER_TIMESTAMP__',
    });
  });

  it('deletes by document id', async () => {
    await createFirestoreBackend().deleteTransaction('abc123');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'transactions', 'abc123');
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('delegates auth to the Firebase SDK', async () => {
    const backend = createFirestoreBackend();
    backend.subscribeToAuth(vi.fn());
    await backend.login();
    await backend.logout();

    expect(onAuthStateChanged).toHaveBeenCalled();
    expect(signInWithPopup).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });
});

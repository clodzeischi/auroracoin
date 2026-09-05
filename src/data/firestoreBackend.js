import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getDb, getAuthInstance, getProvider } from './firebaseApp.js';
import { UNCATEGORIZED } from './categories.js';

/**
 * Documents written before money became decimal store `amount` as a whole
 * number of coins. They are read as hundredths so the ledger stays correct
 * before a migration runs; the distinct field name is what makes telling
 * them apart possible at all.
 */
const readAmountMinor = (data) => {
  if (Number.isFinite(data.amountMinor)) return data.amountMinor;
  if (Number.isFinite(data.amount)) return data.amount * 100;
  return null;
};

const toTransaction = (snapshot) => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    amountMinor: readAmountMinor(data),
    comment: data.comment,
    category: data.category ?? UNCATEGORIZED,
    user: data.user,
    userName: data.userName ?? null,
    // Null until the server resolves serverTimestamp() on a pending write.
    timestamp: data.timestamp ? data.timestamp.toDate() : null,
    editedBy: data.editedBy ?? null,
    editedByName: data.editedByName ?? null,
    editedAt: data.editedAt ? data.editedAt.toDate() : null,
  };
};

const transactionsPath = (familyId, childId) =>
  ['families', familyId, 'children', childId, 'transactions'];

export const createFirestoreBackend = () => ({
  // ---- auth ----
  subscribeToAuth(onUser) {
    return onAuthStateChanged(getAuthInstance(), onUser);
  },

  login() {
    return signInWithPopup(getAuthInstance(), getProvider());
  },

  logout() {
    return signOut(getAuthInstance());
  },

  // ---- family ----
  /**
   * Membership lives on the family document as an array of parent uids, and
   * is found with an array-contains query on an automatic single-field index.
   *
   * The earlier design put membership in a subcollection written alongside the
   * family in one batch. That cannot be secured: rules evaluate a batched
   * write against the state *before* the batch, so the membership document
   * could not verify the family it belonged to - which would have meant
   * allowing anyone to add themselves as a parent of any family.
   */
  subscribeToFamily(uid, onData, onError) {
    const familiesQuery = query(
      collection(getDb(), 'families'),
      where('parentUids', 'array-contains', uid)
    );
    return onSnapshot(
      familiesQuery,
      (snapshot) => {
        const first = snapshot.docs[0];
        onData(first ? { id: first.id, ...first.data() } : null);
      },
      onError
    );
  },

  async createFamily({ uid, name, email, displayName }) {
    const familyRef = doc(collection(getDb(), 'families'));
    await setDoc(familyRef, {
      name,
      createdBy: uid,
      createdAt: serverTimestamp(),
      parentUids: [uid],
      parents: { [uid]: { email, displayName: displayName ?? null } },
    });
    return familyRef.id;
  },

  // ---- children ----
  subscribeToChildren(familyId, onData, onError) {
    const childrenQuery = query(
      collection(getDb(), 'families', familyId, 'children'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(
      childrenQuery,
      (snapshot) =>
        onData(snapshot.docs.map((child) => ({ id: child.id, name: child.data().name }))),
      onError
    );
  },

  async addChild(familyId, { name }) {
    const created = await addDoc(collection(getDb(), 'families', familyId, 'children'), {
      name,
      createdAt: serverTimestamp(),
    });
    return created.id;
  },

  // ---- one child's ledger ----
  ledgerFor(familyId, childId) {
    const path = transactionsPath(familyId, childId);

    return {
      subscribeToTransactions(onData, onError) {
        const transactionsQuery = query(
          collection(getDb(), ...path),
          orderBy('timestamp', 'desc')
        );
        return onSnapshot(
          transactionsQuery,
          (snapshot) => onData(snapshot.docs.map(toTransaction)),
          onError
        );
      },

      addTransaction({ amountMinor, comment, category, user, userName }) {
        return addDoc(collection(getDb(), ...path), {
          amountMinor,
          comment,
          category,
          user,
          userName: userName ?? null,
          timestamp: serverTimestamp(),
        });
      },

      updateTransaction(id, { amountMinor, comment, category, editedBy, editedByName }) {
        // user and timestamp are deliberately not sent: the rules pin them to
        // their existing values, so an edit cannot rewrite authorship or date.
        return updateDoc(doc(getDb(), ...path, id), {
          amountMinor,
          comment,
          category,
          editedBy,
          editedByName: editedByName ?? null,
          editedAt: serverTimestamp(),
        });
      },

      deleteTransaction(id) {
        return deleteDoc(doc(getDb(), ...path, id));
      },
    };
  },
});

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getDb, getAuthInstance, getProvider } from './firebaseApp.js';
import { UNCATEGORIZED } from './categories.js';

const COLLECTION = 'transactions';

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

const toTransaction = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    amountMinor: readAmountMinor(data),
    comment: data.comment,
    // Documents written before categories existed have no field at all.
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

export const createFirestoreBackend = () => ({
  subscribeToAuth(onUser) {
    return onAuthStateChanged(getAuthInstance(), onUser);
  },

  login() {
    return signInWithPopup(getAuthInstance(), getProvider());
  },

  logout() {
    return signOut(getAuthInstance());
  },

  subscribeToTransactions(onData, onError) {
    const transactionsQuery = query(
      collection(getDb(), COLLECTION),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(
      transactionsQuery,
      (snapshot) => onData(snapshot.docs.map(toTransaction)),
      onError
    );
  },

  updateTransaction(id, { amountMinor, comment, category, editedBy, editedByName }) {
    // user and timestamp are deliberately not sent: the rules pin them to
    // their existing values, so an edit cannot rewrite authorship or date.
    return updateDoc(doc(getDb(), COLLECTION, id), {
      amountMinor,
      comment,
      category,
      editedBy,
      editedByName: editedByName ?? null,
      editedAt: serverTimestamp(),
    });
  },

  deleteTransaction(id) {
    return deleteDoc(doc(getDb(), COLLECTION, id));
  },

  addTransaction({ amountMinor, comment, category, user, userName }) {
    return addDoc(collection(getDb(), COLLECTION), {
      amountMinor,
      comment,
      category,
      user,
      userName: userName ?? null,
      timestamp: serverTimestamp(),
    });
  },
});

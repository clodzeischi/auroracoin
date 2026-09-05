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

const toTransaction = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    amount: data.amount,
    comment: data.comment,
    // Documents written before categories existed have no field at all.
    category: data.category ?? UNCATEGORIZED,
    user: data.user,
    // Null until the server resolves serverTimestamp() on a pending write.
    timestamp: data.timestamp ? data.timestamp.toDate() : null,
    editedBy: data.editedBy ?? null,
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

  updateTransaction(id, { amount, comment, category, editedBy }) {
    // user and timestamp are deliberately not sent: the rules pin them to
    // their existing values, so an edit cannot rewrite authorship or date.
    return updateDoc(doc(getDb(), COLLECTION, id), {
      amount,
      comment,
      category,
      editedBy,
      editedAt: serverTimestamp(),
    });
  },

  deleteTransaction(id) {
    return deleteDoc(doc(getDb(), COLLECTION, id));
  },

  addTransaction({ amount, comment, category, user }) {
    return addDoc(collection(getDb(), COLLECTION), {
      amount,
      comment,
      category,
      user,
      timestamp: serverTimestamp(),
    });
  },
});

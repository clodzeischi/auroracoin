import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getDb, getAuthInstance, getProvider } from './firebaseApp.js';

const COLLECTION = 'transactions';

const toTransaction = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    amount: data.amount,
    comment: data.comment,
    user: data.user,
    // Null until the server resolves serverTimestamp() on a pending write.
    timestamp: data.timestamp ? data.timestamp.toDate() : null,
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

  addTransaction({ amount, comment, user }) {
    return addDoc(collection(getDb(), COLLECTION), {
      amount,
      comment,
      user,
      timestamp: serverTimestamp(),
    });
  },
});

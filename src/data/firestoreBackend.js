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
  getDocs,
  writeBatch,
  arrayUnion,
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

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

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

  renameChild(familyId, childId, name) {
    return updateDoc(doc(getDb(), 'families', familyId, 'children', childId), { name });
  },

  /**
   * Firestore does not cascade deletes without server code, so a child's
   * transactions would linger as an invisible orphaned subcollection. They
   * are removed explicitly, in batches, before the child itself.
   */
  async deleteChild(familyId, childId) {
    const db = getDb();
    const path = transactionsPath(familyId, childId);
    const existing = await getDocs(collection(db, ...path));

    const documents = existing.docs;
    for (let index = 0; index < documents.length; index += 400) {
      const batch = writeBatch(db);
      documents.slice(index, index + 400).forEach((entry) => batch.delete(entry.ref));
      await batch.commit();
    }

    await deleteDoc(doc(db, 'families', familyId, 'children', childId));
  },

  // ---- inviting a second parent ----
  /**
   * Keyed by email address, because a person's uid cannot be known until they
   * have signed in at least once - which is exactly the case an invite exists
   * to cover. The address is lower-cased so it matches however it was typed.
   */
  subscribeToInvite(email, onData, onError) {
    return onSnapshot(
      doc(getDb(), 'invites', normalizeEmail(email)),
      (snapshot) => onData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
      onError
    );
  },

  subscribeToPendingInvites(familyId, onData, onError) {
    const pending = query(collection(getDb(), 'invites'), where('familyId', '==', familyId));
    return onSnapshot(
      pending,
      (snapshot) => onData(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
      onError
    );
  },

  inviteParent(familyId, { email, invitedByName }) {
    const address = normalizeEmail(email);
    return setDoc(doc(getDb(), 'invites', address), {
      email: address,
      familyId,
      invitedByName: invitedByName ?? null,
      createdAt: serverTimestamp(),
    });
  },

  cancelInvite(email) {
    return deleteDoc(doc(getDb(), 'invites', normalizeEmail(email)));
  },

  /**
   * Joining and consuming the invite happen together: a partial commit would
   * either leave a replayable invite or add a parent who never had one.
   */
  acceptInvite(familyId, { uid, email, displayName }) {
    const db = getDb();
    const address = normalizeEmail(email);

    const batch = writeBatch(db);
    batch.update(doc(db, 'families', familyId), {
      parentUids: arrayUnion(uid),
      [`parents.${uid}`]: { email: address, displayName: displayName ?? null },
    });
    batch.delete(doc(db, 'invites', address));
    return batch.commit();
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

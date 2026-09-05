import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signInAnonymously, signOut } from 'firebase/auth';
import { getDb, getAuthInstance, getProvider } from './firebaseApp.js';
import { UNCATEGORIZED } from './categories.js';
import {
  generatePairingCode,
  normalizePairingCode,
  pairingExpiry,
  pairingFailure,
  PAIRING_EXPIRED,
  PAIRING_UNKNOWN,
} from './pairing.js';

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

// Every subscription here hands components one of two shapes: a single document
// that may not exist, or a list. Keeping both in one place means the document
// id is merged in the same way everywhere.
const docOrNull = (snapshot) =>
  snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;

const withIds = (snapshot) =>
  snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

const transactionsPath = (familyId, childId) =>
  ['families', familyId, 'children', childId, 'transactions'];

const ledgerKey = (familyId, childId) => `${familyId}/${childId}`;

export const createFirestoreBackend = () => {
  /**
   * Ledger handles are cached by family and child.
   *
   * Components receive a ledger as a prop and subscribe to it in an effect
   * keyed on its identity. Returning a fresh object per call would make that
   * identity change on every render of any ancestor, tearing down and
   * re-establishing a Firestore listener - and paying for the reads again -
   * every time an unrelated dialog opened.
   */
  const ledgers = new Map();

  const makeLedger = (familyId, childId) => {
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
  };

  return {
    // ---- auth ----
    subscribeToAuth(onUser) {
      return onAuthStateChanged(getAuthInstance(), onUser);
    },

    login() {
      return signInWithPopup(getAuthInstance(), getProvider());
    },

    /**
     * A child's device signs in anonymously and stays that way. It never has
     * an email, which is what makes it recognisable as a child session, and
     * what stops it satisfying any rule that writes to a ledger.
     */
    startChildSession() {
      return signInAnonymously(getAuthInstance());
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
          // One household per parent is all the UI offers today. Sorting by id
          // rather than taking whatever the snapshot happens to list first
          // means someone who does end up in two sees the same one every load,
          // instead of flipping between households between refreshes. Sorting
          // client-side avoids a composite index that array-contains plus an
          // orderBy would otherwise require.
          const first = [...snapshot.docs].sort((a, b) => a.id.localeCompare(b.id))[0];
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

    subscribeToChild(familyId, childId, onData, onError) {
      return onSnapshot(
        doc(getDb(), 'families', familyId, 'children', childId),
        (snapshot) => onData(docOrNull(snapshot)),
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
     * are removed explicitly, in batches, before the child itself - as are the
     * devices paired to them, which would otherwise keep a device pointed at
     * a ledger that no longer exists.
     */
    async deleteChild(familyId, childId) {
      const db = getDb();

      // All three reads are independent, so they go out together rather than
      // paying a round trip each. Two equality filters need no composite
      // index; Firestore merges the automatic single-field ones.
      const forThisChild = (name) =>
        getDocs(query(
          collection(db, name),
          where('familyId', '==', familyId),
          where('childId', '==', childId)
        ));

      const [transactions, pairedDevices, openCodes] = await Promise.all([
        getDocs(collection(db, ...transactionsPath(familyId, childId))),
        forThisChild('devices'),
        forThisChild('pairings'),
      ]);

      // The child document goes last, in the final batch: until it is gone the
      // others are still reachable, so an interrupted delete leaves something
      // a retry can finish rather than an orphan nothing points at.
      const doomed = [...transactions.docs, ...pairedDevices.docs, ...openCodes.docs]
        .map((entry) => entry.ref)
        .concat(doc(db, 'families', familyId, 'children', childId));

      for (let index = 0; index < doomed.length; index += 400) {
        const batch = writeBatch(db);
        doomed.slice(index, index + 400).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }
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
        (snapshot) => onData(docOrNull(snapshot)),
        onError
      );
    },

    subscribeToPendingInvites(familyId, onData, onError) {
      const pending = query(collection(getDb(), 'invites'), where('familyId', '==', familyId));
      return onSnapshot(pending, (snapshot) => onData(withIds(snapshot)), onError);
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

    // ---- pairing a child's device ----
    subscribeToDevice(uid, onData, onError) {
      return onSnapshot(doc(getDb(), 'devices', uid), (snapshot) => onData(docOrNull(snapshot)), onError);
    },

    subscribeToDevices(familyId, onData, onError) {
      const paired = query(collection(getDb(), 'devices'), where('familyId', '==', familyId));
      return onSnapshot(paired, (snapshot) => onData(withIds(snapshot)), onError);
    },

    subscribeToPairings(familyId, onData, onError) {
      const outstanding = query(
        collection(getDb(), 'pairings'),
        where('familyId', '==', familyId)
      );
      return onSnapshot(
        outstanding,
        (snapshot) =>
          onData(
            snapshot.docs.map((entry) => {
              const data = entry.data();
              return {
                id: entry.id,
                code: entry.id,
                childId: data.childId,
                expiresAt: data.expiresAt ? data.expiresAt.toDate() : null,
              };
            })
          ),
        onError
      );
    },

    /**
     * The code is the document id, so two codes colliding is a write to an
     * existing document - which the rules classify as an update and refuse
     * outright. A collision therefore fails loudly instead of quietly
     * repointing somebody else's pending pairing at this child.
     */
    async createPairingCode(familyId, childId) {
      const code = generatePairingCode();
      await setDoc(doc(getDb(), 'pairings', code), {
        familyId,
        childId,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(pairingExpiry()),
      });
      return code;
    },

    cancelPairingCode(code) {
      return deleteDoc(doc(getDb(), 'pairings', normalizePairingCode(code)));
    },

    /**
     * Redeeming reads the ticket, then writes the device record and destroys
     * the ticket in one batch, so a code cannot be used twice.
     *
     * The expiry check here is only so the child sees "that code has expired"
     * instead of a bare permission error; the rules enforce it independently
     * and are the copy that matters.
     */
    async redeemPairingCode(rawCode, uid) {
      const db = getDb();
      const code = normalizePairingCode(rawCode);
      const pairingRef = doc(db, 'pairings', code);

      const snapshot = await getDoc(pairingRef);
      if (!snapshot.exists()) throw pairingFailure(PAIRING_UNKNOWN);

      const { familyId, childId, expiresAt } = snapshot.data();
      if (expiresAt && expiresAt.toMillis() <= Date.now()) throw pairingFailure(PAIRING_EXPIRED);

      const batch = writeBatch(db);
      batch.set(doc(db, 'devices', uid), {
        familyId,
        childId,
        code,
        pairedAt: serverTimestamp(),
      });
      batch.delete(pairingRef);
      await batch.commit();
    },

    unpairDevice(uid) {
      return deleteDoc(doc(getDb(), 'devices', uid));
    },

    // ---- one child's ledger ----
    ledgerFor(familyId, childId) {
      const id = ledgerKey(familyId, childId);
      if (!ledgers.has(id)) ledgers.set(id, makeLedger(familyId, childId));
      return ledgers.get(id);
    },
  };
};

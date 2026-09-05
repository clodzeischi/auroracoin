export const MOCK_FAMILY_ID = 'mock-family';
export const MOCK_CHILD_ID = 'mock-child';

const MOCK_PARENT = {
  uid: 'mock-parent-uid',
  email: 'parent@example.com',
  displayName: 'Constantin',
};

// A paired child device: anonymous, no email, nothing identifying.
const MOCK_CHILD_USER = {
  uid: 'mock-child-uid',
  isAnonymous: true,
  displayName: 'Sparrow',
  role: 'child',
  // In production these come from the family's childDevices map at pairing.
  familyId: MOCK_FAMILY_ID,
  childId: MOCK_CHILD_ID,
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}-${++idCounter}`;

// Relative to now, so seeds are always in the recent past. Fixed dates drift
// into the future as the calendar catches up, which puts them ahead of newly
// added entries in a newest-first ledger.
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// Fresh objects on every call so two backends never share state.
const seedTransactions = () => [
  {
    id: 'seed-1',
    amountMinor: 1000,
    comment: 'Tidied her room all week',
    category: 'chores',
    user: 'parent@example.com',
    userName: 'Constantin',
    timestamp: daysAgo(9),
    editedBy: null,
    editedByName: null,
    editedAt: null,
  },
  {
    id: 'seed-2',
    amountMinor: -450,
    comment: 'Spent on stickers',
    category: 'treats',
    user: 'parent@example.com',
    userName: 'Constantin',
    timestamp: daysAgo(4),
    editedBy: null,
    editedByName: null,
    editedAt: null,
  },
  {
    id: 'seed-3',
    amountMinor: 2500,
    comment: 'Birthday from Grandma',
    category: 'gift',
    user: 'otherparent@example.com',
    userName: 'Deeanna',
    timestamp: daysAgo(2),
    editedBy: null,
    editedByName: null,
    editedAt: null,
  },
];

/**
 * In-memory stand-in for the Firestore backend. Same interface, no network,
 * no credentials, no Firebase project. Used automatically in dev.
 */
const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

export const createMockBackend = ({ seed = true } = {}) => {
  const families = new Map();          // familyId -> { id, name, createdBy }
  const memberships = new Map();       // uid -> Set(familyId)
  const children = new Map();          // familyId -> [{ id, name }]
  const ledgers = new Map();           // `${familyId}/${childId}` -> transactions[]
  const invites = new Map();           // email -> { email, familyId, invitedByName }

  let user = null;
  const authListeners = new Set();
  const familyListeners = new Map();   // uid -> Set(cb)
  const childListeners = new Map();    // familyId -> Set(cb)
  const ledgerListeners = new Map();   // key -> Set(cb)

  const key = (familyId, childId) => `${familyId}/${childId}`;
  const listenersFor = (map, id) => {
    if (!map.has(id)) map.set(id, new Set());
    return map.get(id);
  };

  const familyOf = (uid) => {
    const ids = memberships.get(uid);
    if (!ids || ids.size === 0) return null;
    return families.get([...ids][0]) ?? null;
  };

  const inviteListeners = new Map();   // email -> Set(cb)
  const pendingListeners = new Map();  // familyId -> Set(cb)

  const notifyAuth = () => authListeners.forEach((l) => l(user));
  const notifyFamily = (uid) => listenersFor(familyListeners, uid).forEach((l) => l(familyOf(uid)));
  const notifyChildren = (familyId) =>
    listenersFor(childListeners, familyId).forEach((l) => l([...(children.get(familyId) ?? [])]));

  const notifyInvite = (email) =>
    listenersFor(inviteListeners, email).forEach((l) => l(invites.get(email) ?? null));
  const notifyPending = (familyId) =>
    listenersFor(pendingListeners, familyId).forEach((l) =>
      l([...invites.values()].filter((invite) => invite.familyId === familyId))
    );

  const newestFirst = (list) =>
    [...list].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const notifyLedger = (familyId, childId) => {
    const rows = newestFirst(ledgers.get(key(familyId, childId)) ?? []);
    listenersFor(ledgerListeners, key(familyId, childId)).forEach((l) => l(rows));
  };

  const applySeed = () => {
    families.set(MOCK_FAMILY_ID, {
      id: MOCK_FAMILY_ID,
      name: 'The Aurora House',
      createdBy: MOCK_PARENT.uid,
    });
    memberships.set(MOCK_PARENT.uid, new Set([MOCK_FAMILY_ID]));
    children.set(MOCK_FAMILY_ID, [
      { id: MOCK_CHILD_ID, name: 'Sparrow' },
      { id: 'mock-child-2', name: 'Wren' },
    ]);
    ledgers.set(key(MOCK_FAMILY_ID, MOCK_CHILD_ID), seedTransactions());
    ledgers.set(key(MOCK_FAMILY_ID, 'mock-child-2'), [
      {
        id: 'seed-4',
        amountMinor: 1500,
        comment: 'Helped with the dishes',
        category: 'chores',
        user: 'parent@example.com',
        userName: 'Constantin',
        timestamp: daysAgo(6),
        editedBy: null,
        editedByName: null,
        editedAt: null,
      },
    ]);
  };

  const clearAll = () => {
    families.clear();
    memberships.clear();
    children.clear();
    ledgers.clear();
    invites.clear();
  };

  if (seed) applySeed();

  const notifyEverything = () => {
    [...familyListeners.keys()].forEach(notifyFamily);
    [...childListeners.keys()].forEach(notifyChildren);
    [...inviteListeners.keys()].forEach(notifyInvite);
    [...pendingListeners.keys()].forEach(notifyPending);
    [...ledgerListeners.keys()].forEach((id) => {
      const [familyId, childId] = id.split('/');
      notifyLedger(familyId, childId);
    });
  };

  return {
    // ---- auth ----
    subscribeToAuth(onUser) {
      authListeners.add(onUser);
      onUser(user);
      return () => authListeners.delete(onUser);
    },

    loginAs(role) {
      user = role === 'child' ? MOCK_CHILD_USER : MOCK_PARENT;
      notifyAuth();
      return Promise.resolve();
    },

    login() {
      return this.loginAs('parent');
    },

    logout() {
      user = null;
      notifyAuth();
      return Promise.resolve();
    },

    // ---- family ----
    subscribeToFamily(uid, onData) {
      const listeners = listenersFor(familyListeners, uid);
      listeners.add(onData);
      onData(familyOf(uid));
      return () => listeners.delete(onData);
    },

    createFamily({ uid, name }) {
      const familyId = nextId('family');
      families.set(familyId, { id: familyId, name, createdBy: uid });
      memberships.set(uid, new Set([...(memberships.get(uid) ?? []), familyId]));
      children.set(familyId, []);
      notifyFamily(uid);
      return Promise.resolve(familyId);
    },

    // ---- children ----
    subscribeToChildren(familyId, onData) {
      const listeners = listenersFor(childListeners, familyId);
      listeners.add(onData);
      onData([...(children.get(familyId) ?? [])]);
      return () => listeners.delete(onData);
    },

    addChild(familyId, { name }) {
      const childId = nextId('child');
      children.set(familyId, [...(children.get(familyId) ?? []), { id: childId, name }]);
      ledgers.set(key(familyId, childId), []);
      notifyChildren(familyId);
      return Promise.resolve(childId);
    },

    renameChild(familyId, childId, name) {
      children.set(familyId, (children.get(familyId) ?? []).map((child) =>
        child.id === childId ? { ...child, name } : child
      ));
      notifyChildren(familyId);
      return Promise.resolve();
    },

    deleteChild(familyId, childId) {
      children.set(familyId, (children.get(familyId) ?? []).filter((c) => c.id !== childId));
      // Nothing cascades in Firestore, so the ledger goes explicitly.
      ledgers.delete(key(familyId, childId));
      notifyChildren(familyId);
      notifyLedger(familyId, childId);
      return Promise.resolve();
    },

    // ---- inviting a second parent ----
    subscribeToInvite(email, onData) {
      const address = normalizeEmail(email);
      const listeners = listenersFor(inviteListeners, address);
      listeners.add(onData);
      onData(invites.get(address) ?? null);
      return () => listeners.delete(onData);
    },

    subscribeToPendingInvites(familyId, onData) {
      const listeners = listenersFor(pendingListeners, familyId);
      listeners.add(onData);
      onData([...invites.values()].filter((invite) => invite.familyId === familyId));
      return () => listeners.delete(onData);
    },

    inviteParent(familyId, { email, invitedByName }) {
      const address = normalizeEmail(email);
      invites.set(address, { email: address, familyId, invitedByName });
      notifyInvite(address);
      notifyPending(familyId);
      return Promise.resolve();
    },

    cancelInvite(email) {
      const address = normalizeEmail(email);
      const invite = invites.get(address);
      invites.delete(address);
      notifyInvite(address);
      if (invite) notifyPending(invite.familyId);
      return Promise.resolve();
    },

    acceptInvite(familyId, { uid, email }) {
      const address = normalizeEmail(email);
      memberships.set(uid, new Set([...(memberships.get(uid) ?? []), familyId]));
      invites.delete(address);
      notifyFamily(uid);
      notifyInvite(address);
      notifyPending(familyId);
      return Promise.resolve();
    },

    // ---- dev only: walk onboarding against an empty household ----
    resetForDev({ seed: reseed = false } = {}) {
      clearAll();
      if (reseed) applySeed();
      notifyEverything();
      return Promise.resolve();
    },

    // ---- one child's ledger; the shape components already consume ----
    ledgerFor(familyId, childId) {
      const id = key(familyId, childId);
      return {
        subscribeToTransactions(onData) {
          const listeners = listenersFor(ledgerListeners, id);
          listeners.add(onData);
          onData(newestFirst(ledgers.get(id) ?? []));
          return () => listeners.delete(onData);
        },

        addTransaction({ amountMinor, comment, category, user: author, userName }) {
          ledgers.set(id, [
            ...(ledgers.get(id) ?? []),
            {
              id: nextId('tx'),
              amountMinor,
              comment,
              category,
              user: author,
              userName,
              timestamp: new Date(),
              editedBy: null,
              editedByName: null,
              editedAt: null,
            },
          ]);
          notifyLedger(familyId, childId);
          return Promise.resolve();
        },

        updateTransaction(transactionId, { amountMinor, comment, category, editedBy, editedByName }) {
          ledgers.set(id, (ledgers.get(id) ?? []).map((transaction) =>
            transaction.id === transactionId
              // Spread first so author and timestamp survive the edit.
              ? { ...transaction, amountMinor, comment, category, editedBy, editedByName, editedAt: new Date() }
              : transaction
          ));
          notifyLedger(familyId, childId);
          return Promise.resolve();
        },

        deleteTransaction(transactionId) {
          ledgers.set(id, (ledgers.get(id) ?? []).filter((t) => t.id !== transactionId));
          notifyLedger(familyId, childId);
          return Promise.resolve();
        },
      };
    },
  };
};

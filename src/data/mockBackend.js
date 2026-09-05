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
export const createMockBackend = ({ seed = true } = {}) => {
  const families = new Map();          // familyId -> { id, name, createdBy }
  const memberships = new Map();       // uid -> Set(familyId)
  const children = new Map();          // familyId -> [{ id, name }]
  const ledgers = new Map();           // `${familyId}/${childId}` -> transactions[]

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

  const notifyAuth = () => authListeners.forEach((l) => l(user));
  const notifyFamily = (uid) => listenersFor(familyListeners, uid).forEach((l) => l(familyOf(uid)));
  const notifyChildren = (familyId) =>
    listenersFor(childListeners, familyId).forEach((l) => l([...(children.get(familyId) ?? [])]));

  const newestFirst = (list) =>
    [...list].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const notifyLedger = (familyId, childId) => {
    const rows = newestFirst(ledgers.get(key(familyId, childId)) ?? []);
    listenersFor(ledgerListeners, key(familyId, childId)).forEach((l) => l(rows));
  };

  if (seed) {
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
  }

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

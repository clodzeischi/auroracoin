import {
  generatePairingCode,
  normalizePairingCode,
  pairingExpiry,
  pairingFailure,
  PAIRING_EXPIRED,
  PAIRING_UNKNOWN,
} from './pairing.js';

export const MOCK_FAMILY_ID = 'mock-family';
export const MOCK_CHILD_ID = 'mock-child';

// `persona` is what the dev banner highlights. It lives on the mock user so
// the banner never has to know which uid stands for which persona - roleFor()
// ignores it and still derives the real answer from anonymity alone.
const MOCK_PARENT = {
  uid: 'mock-parent-uid',
  email: 'parent@example.com',
  displayName: 'Constantin',
  persona: 'parent',
};

// Two child devices, so both halves of the pairing flow can be walked in dev:
// one already paired to Sparrow, one that has never redeemed a code.
export const MOCK_PAIRED_DEVICE_UID = 'mock-device-paired';
export const MOCK_UNPAIRED_DEVICE_UID = 'mock-device-unpaired';

// A child device is anonymous: no email, nothing identifying. What it may see
// comes from its device record, never from the session itself.
const childUser = (uid, persona) => ({ uid, isAnonymous: true, persona });

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
  const devices = new Map();           // uid -> { id, familyId, childId }
  const pairings = new Map();          // code -> { id, code, familyId, childId, expiresAt }

  let user = null;
  const authListeners = new Set();

  const key = (familyId, childId) => `${familyId}/${childId}`;
  const listenersFor = (map, id) => {
    if (!map.has(id)) map.set(id, new Set());
    return map.get(id);
  };

  const familyOf = (uid) => {
    const ids = memberships.get(uid);
    if (!ids || ids.size === 0) return null;
    return families.get([...ids].sort()[0]) ?? null;
  };

  const childIn = (familyId, childId) =>
    (children.get(familyId) ?? []).find((child) => child.id === childId) ?? null;

  const byFamily = (map, familyId) =>
    [...map.values()].filter((entry) => entry.familyId === familyId);

  const newestFirst = (list) =>
    [...list].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  /**
   * A feed binds a set of listeners to the one expression that reads its
   * current value. Writing that expression once - rather than once for the
   * initial call and again inside a matching notifier - is what keeps the two
   * from drifting as subscriptions are added.
   */
  const feeds = [];
  const feed = (read) => {
    const listeners = new Map();
    const entry = {
      listeners,
      notify: (id) => listenersFor(listeners, id).forEach((listener) => listener(read(id))),
      subscribe: (id, onData) => {
        const set = listenersFor(listeners, id);
        set.add(onData);
        onData(read(id));
        return () => set.delete(onData);
      },
    };
    feeds.push(entry);
    return entry;
  };

  const familyFeed = feed(familyOf);
  const childrenFeed = feed((familyId) => [...(children.get(familyId) ?? [])]);
  // Keyed by `${familyId}/${childId}`, like the ledgers.
  const childFeed = feed((id) => childIn(...id.split('/')));
  const ledgerFeed = feed((id) => newestFirst(ledgers.get(id) ?? []));
  const inviteFeed = feed((email) => invites.get(email) ?? null);
  const pendingFeed = feed((familyId) => byFamily(invites, familyId));
  const deviceFeed = feed((uid) => devices.get(uid) ?? null);
  const devicesFeed = feed((familyId) => byFamily(devices, familyId));
  const pairingFeed = feed((familyId) => byFamily(pairings, familyId));

  const notifyAuth = () => authListeners.forEach((listener) => listener(user));

  // Renaming or removing a child changes both the family's list and whichever
  // single-child views are open on it.
  const notifyChildren = (familyId) => {
    childrenFeed.notify(familyId);
    [...childFeed.listeners.keys()]
      .filter((id) => id.startsWith(`${familyId}/`))
      .forEach(childFeed.notify);
  };

  const notifyLedger = (familyId, childId) => ledgerFeed.notify(key(familyId, childId));

  // Ledger handles are cached so their identity is stable across renders; see
  // the same cache in firestoreBackend for why that matters. Nothing is ever
  // evicted: a handle holds two ids and no data, so it cannot go stale, and
  // the map is bounded by the number of children a session has looked at.
  const ledgerHandles = new Map();

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
    devices.set(MOCK_PAIRED_DEVICE_UID, {
      id: MOCK_PAIRED_DEVICE_UID,
      familyId: MOCK_FAMILY_ID,
      childId: MOCK_CHILD_ID,
      code: 'SEEDED',
      pairedAt: daysAgo(30),
    });
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
    devices.clear();
    pairings.clear();
  };

  if (seed) applySeed();

  const notifyEverything = () =>
    feeds.forEach((entry) => [...entry.listeners.keys()].forEach(entry.notify));

  const makeLedger = (familyId, childId) => {
    const id = key(familyId, childId);
    return {
      subscribeToTransactions(onData) {
        return ledgerFeed.subscribe(id, onData);
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
  };

  return {
    // ---- auth ----
    subscribeToAuth(onUser) {
      authListeners.add(onUser);
      onUser(user);
      return () => authListeners.delete(onUser);
    },

    loginAs(role) {
      if (role === 'child') user = childUser(MOCK_PAIRED_DEVICE_UID, 'child');
      else if (role === 'child-unpaired') user = childUser(MOCK_UNPAIRED_DEVICE_UID, 'child-unpaired');
      else user = MOCK_PARENT;
      notifyAuth();
      return Promise.resolve();
    },

    login() {
      return this.loginAs('parent');
    },

    startChildSession() {
      return this.loginAs('child-unpaired');
    },

    logout() {
      user = null;
      notifyAuth();
      return Promise.resolve();
    },

    // ---- family ----
    subscribeToFamily(uid, onData) {
      return familyFeed.subscribe(uid, onData);
    },

    createFamily({ uid, name }) {
      const familyId = nextId('family');
      families.set(familyId, { id: familyId, name, createdBy: uid });
      memberships.set(uid, new Set([...(memberships.get(uid) ?? []), familyId]));
      children.set(familyId, []);
      familyFeed.notify(uid);
      return Promise.resolve(familyId);
    },

    // ---- children ----
    subscribeToChildren(familyId, onData) {
      return childrenFeed.subscribe(familyId, onData);
    },

    subscribeToChild(familyId, childId, onData) {
      return childFeed.subscribe(key(familyId, childId), onData);
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
      // Nothing cascades in Firestore, so the ledger, any paired devices and
      // any unredeemed codes go explicitly - otherwise a device is left
      // pointed at a missing child, or a code can still pair one to it.
      ledgers.delete(key(familyId, childId));
      [...devices.values()]
        .filter((device) => device.familyId === familyId && device.childId === childId)
        .forEach((device) => {
          devices.delete(device.id);
          deviceFeed.notify(device.id);
        });
      [...pairings.values()]
        .filter((pairing) => pairing.familyId === familyId && pairing.childId === childId)
        .forEach((pairing) => pairings.delete(pairing.code));
      notifyChildren(familyId);
      devicesFeed.notify(familyId);
      pairingFeed.notify(familyId);
      notifyLedger(familyId, childId);
      return Promise.resolve();
    },

    // ---- inviting a second parent ----
    subscribeToInvite(email, onData) {
      return inviteFeed.subscribe(normalizeEmail(email), onData);
    },

    subscribeToPendingInvites(familyId, onData) {
      return pendingFeed.subscribe(familyId, onData);
    },

    inviteParent(familyId, { email, invitedByName }) {
      const address = normalizeEmail(email);
      invites.set(address, { email: address, familyId, invitedByName });
      inviteFeed.notify(address);
      pendingFeed.notify(familyId);
      return Promise.resolve();
    },

    cancelInvite(email) {
      const address = normalizeEmail(email);
      const invite = invites.get(address);
      invites.delete(address);
      inviteFeed.notify(address);
      if (invite) pendingFeed.notify(invite.familyId);
      return Promise.resolve();
    },

    acceptInvite(familyId, { uid, email }) {
      const address = normalizeEmail(email);
      memberships.set(uid, new Set([...(memberships.get(uid) ?? []), familyId]));
      invites.delete(address);
      familyFeed.notify(uid);
      inviteFeed.notify(address);
      pendingFeed.notify(familyId);
      return Promise.resolve();
    },

    // ---- pairing a child's device ----
    subscribeToDevice(uid, onData) {
      return deviceFeed.subscribe(uid, onData);
    },

    subscribeToDevices(familyId, onData) {
      return devicesFeed.subscribe(familyId, onData);
    },

    subscribeToPairings(familyId, onData) {
      return pairingFeed.subscribe(familyId, onData);
    },

    createPairingCode(familyId, childId) {
      const code = generatePairingCode();
      pairings.set(code, {
        id: code,
        code,
        familyId,
        childId,
        expiresAt: pairingExpiry(),
      });
      pairingFeed.notify(familyId);
      return Promise.resolve(code);
    },

    cancelPairingCode(rawCode) {
      const code = normalizePairingCode(rawCode);
      const pairing = pairings.get(code);
      pairings.delete(code);
      if (pairing) pairingFeed.notify(pairing.familyId);
      return Promise.resolve();
    },

    redeemPairingCode(rawCode, uid) {
      const code = normalizePairingCode(rawCode);
      const pairing = pairings.get(code);
      if (!pairing) return Promise.reject(pairingFailure(PAIRING_UNKNOWN));
      if (pairing.expiresAt && pairing.expiresAt.getTime() <= Date.now()) {
        return Promise.reject(pairingFailure(PAIRING_EXPIRED));
      }

      devices.set(uid, {
        id: uid,
        familyId: pairing.familyId,
        childId: pairing.childId,
        code,
        pairedAt: new Date(),
      });
      pairings.delete(code);
      deviceFeed.notify(uid);
      devicesFeed.notify(pairing.familyId);
      pairingFeed.notify(pairing.familyId);
      return Promise.resolve();
    },

    unpairDevice(uid) {
      const device = devices.get(uid);
      devices.delete(uid);
      deviceFeed.notify(uid);
      if (device) devicesFeed.notify(device.familyId);
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
      if (!ledgerHandles.has(id)) ledgerHandles.set(id, makeLedger(familyId, childId));
      return ledgerHandles.get(id);
    },
  };
};

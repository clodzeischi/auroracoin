const MOCK_USER = {
  uid: 'mock-parent-uid',
  email: 'parent@example.com',
  displayName: 'Mock Parent',
};

let idCounter = 0;
const nextId = () => `mock-${++idCounter}`;

// Fresh objects on every call so two backends never share state.
const seedTransactions = () => [
  {
    id: 'seed-1',
    amountMinor: 1000,
    comment: 'Tidied her room all week',
    category: 'chores',
    user: 'parent@example.com',
    timestamp: new Date('2026-01-05T09:00:00Z'),
  },
  {
    id: 'seed-2',
    amountMinor: -450,
    comment: 'Spent on stickers',
    category: 'treats',
    user: 'parent@example.com',
    timestamp: new Date('2026-01-11T17:30:00Z'),
  },
  {
    id: 'seed-3',
    amountMinor: 2500,
    comment: 'Birthday from Grandma',
    category: 'gift',
    user: 'otherparent@example.com',
    timestamp: new Date('2026-02-02T12:00:00Z'),
  },
];

/**
 * In-memory stand-in for the Firestore backend. Same interface, no network,
 * no credentials, no Firebase project. Used automatically in dev.
 */
export const createMockBackend = () => {
  let transactions = seedTransactions();
  let user = null;
  const dataListeners = new Set();
  const authListeners = new Set();

  const newestFirst = () =>
    [...transactions].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const notifyData = () => dataListeners.forEach((listener) => listener(newestFirst()));
  const notifyAuth = () => authListeners.forEach((listener) => listener(user));

  return {
    subscribeToAuth(onUser) {
      authListeners.add(onUser);
      onUser(user);
      return () => authListeners.delete(onUser);
    },

    login() {
      user = MOCK_USER;
      notifyAuth();
      return Promise.resolve();
    },

    logout() {
      user = null;
      notifyAuth();
      return Promise.resolve();
    },

    subscribeToTransactions(onData) {
      dataListeners.add(onData);
      onData(newestFirst());
      return () => dataListeners.delete(onData);
    },

    updateTransaction(id, { amountMinor, comment, category, editedBy }) {
      transactions = transactions.map((transaction) =>
        transaction.id === id
          // Spread first so author and timestamp survive the edit.
          ? { ...transaction, amountMinor, comment, category, editedBy, editedAt: new Date() }
          : transaction
      );
      notifyData();
      return Promise.resolve();
    },

    deleteTransaction(id) {
      transactions = transactions.filter((transaction) => transaction.id !== id);
      notifyData();
      return Promise.resolve();
    },

    addTransaction({ amountMinor, comment, category, user: author }) {
      transactions = [
        ...transactions,
        { id: nextId(), amountMinor, comment, category, user: author, timestamp: new Date() },
      ];
      notifyData();
      return Promise.resolve();
    },
  };
};

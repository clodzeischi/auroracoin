import { vi } from 'vitest';

/**
 * A hand-rolled test double for the backend interface.
 *
 * Hooks take their backend as an argument, so unit tests never touch Firestore,
 * the mock backend, or module mocking - they just pass one of these in and drive
 * it directly with `emitAuth` / `emitTransactions`.
 */
export const createFakeBackend = () => {
  let authListener = null;
  let dataListener = null;
  let dataErrorListener = null;

  return {
    unsubscribeAuth: vi.fn(),
    unsubscribeTransactions: vi.fn(),

    subscribeToAuth: vi.fn(function (onUser) {
      authListener = onUser;
      return this.unsubscribeAuth;
    }),
    subscribeToTransactions: vi.fn(function (onData, onError) {
      dataListener = onData;
      dataErrorListener = onError;
      return this.unsubscribeTransactions;
    }),
    login: vi.fn(() => Promise.resolve()),
    logout: vi.fn(() => Promise.resolve()),
    addTransaction: vi.fn(() => Promise.resolve()),
    updateTransaction: vi.fn(() => Promise.resolve()),
    deleteTransaction: vi.fn(() => Promise.resolve()),

    emitAuth: (user) => authListener(user),
    emitTransactions: (transactions) => dataListener(transactions),
    emitTransactionsError: (error) => dataErrorListener(error),
  };
};

export const tx = (overrides = {}) => ({
  id: 'tx-1',
  amountMinor: 500,
  comment: 'tidied her room',
  category: 'chores',
  user: 'parent@example.com',
  timestamp: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({ __app: true })) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ __auth: true })),
  GoogleAuthProvider: vi.fn(function () {
    this.__provider = true;
  }),
}));
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn(() => ({ __db: true })) }));

import { initializeApp } from 'firebase/app';

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('firebaseApp', () => {
  it('does not initialize Firebase merely by being imported', async () => {
    // This is what lets mock mode run with no .env at all: importing the data
    // layer must never reach for credentials that are not there.
    await import('./firebaseApp.js');

    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('initializes exactly once, on first use, and caches the app', async () => {
    const { getDb, getAuthInstance } = await import('./firebaseApp.js');

    getDb();
    getDb();
    getAuthInstance();

    expect(initializeApp).toHaveBeenCalledTimes(1);
  });
});

import { useEffect, useState } from 'react';

// Stable identities, so passing an empty value into an effect's dependencies
// does not re-subscribe on every render.
const NOTHING = null;
const NO_ITEMS = [];

/**
 * Every live view in this app has the same shape: subscribe while the ids it
 * needs are known, fall back to an empty value when they are not, and let go
 * on unmount. That shape lives here once, and the named hooks around it stay
 * one-liners so each concept still has a name where it is used.
 *
 * A subscription error resets to the empty value rather than surfacing one.
 * Every consumer of these renders the same thing for "nothing here" and "not
 * allowed to look"; the two hooks that must tell those apart - useDevice and
 * useTransactions - keep their own state and are deliberately not built on it.
 */
const useLive = (backend, method, empty, keyA, keyB) => {
  const [value, setValue] = useState(empty);

  useEffect(() => {
    // A second key is optional; `undefined` means this subscription takes one.
    const keys = keyB === undefined ? [keyA] : [keyA, keyB];
    if (keys.some((key) => !key)) {
      setValue(empty);
      return undefined;
    }

    const unsubscribe = backend[method](...keys, setValue, () => setValue(empty));
    return () => unsubscribe();
  }, [backend, method, empty, keyA, keyB]);

  return value;
};

/** A single document, or null when there is none. */
export const useLiveDoc = (backend, method, keyA, keyB) =>
  useLive(backend, method, NOTHING, keyA, keyB);

/** A collection, or an empty array when there is none. */
export const useLiveList = (backend, method, keyA, keyB) =>
  useLive(backend, method, NO_ITEMS, keyA, keyB);

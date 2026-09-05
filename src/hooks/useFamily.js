import { useEffect, useState } from 'react';
import { getBackend } from '../data/index.js';

/**
 * The signed-in parent's family and its children.
 *
 * Two subscriptions rather than one: the family is found by membership, and
 * the children hang off whichever family that turns out to be.
 */
export const useFamily = (backend = getBackend(), user = null) => {
  const [family, setFamily] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const uid = user?.uid ?? null;
  const familyId = family?.id ?? null;

  useEffect(() => {
    if (!uid) {
      setFamily(null);
      setChildren([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = backend.subscribeToFamily(
      uid,
      (next) => {
        setFamily(next);
        // No family means onboarding, and there are no children to wait for.
        if (!next) setLoading(false);
      },
      (subscriptionError) => {
        setError(subscriptionError);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [backend, uid]);

  useEffect(() => {
    if (!familyId) return undefined;

    const unsubscribe = backend.subscribeToChildren(
      familyId,
      (next) => {
        setChildren(next);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(subscriptionError);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [backend, familyId]);

  return { family, children, loading, error };
};

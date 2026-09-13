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

    let cancelled = false;
    let retryTimer = null;
    let attempt = 0;
    let unsubscribe = () => {};

    const subscribe = () => {
      unsubscribe = backend.subscribeToChildren(
        familyId,
        (next) => {
          setChildren(next);
          setLoading(false);
        },
        (subscriptionError) => {
          // This subscription's rule does a get() on the family document to
          // check membership, and Firestore's rule evaluation can briefly lag
          // behind a write it has not yet propagated to - see createFamily,
          // which finishes right before this effect first runs. A one-shot
          // read would just get retried by whoever called it; onSnapshot
          // instead treats permission-denied as terminal and never retries on
          // its own, so a family that was *just* created could look
          // permanently childless and leave the add-children step
          // unleaveable. It always resolves within a couple of seconds once
          // the rule catches up, so retry a few times before believing it.
          if (subscriptionError?.code === 'permission-denied' && attempt < 4 && !cancelled) {
            attempt += 1;
            retryTimer = setTimeout(subscribe, 750 * attempt);
            return;
          }
          setError(subscriptionError);
          setLoading(false);
        }
      );
    };
    subscribe();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      unsubscribe();
    };
  }, [backend, familyId]);

  return { family, children, loading, error };
};

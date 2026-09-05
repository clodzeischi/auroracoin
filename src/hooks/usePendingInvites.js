import { useEffect, useState } from 'react';

/** Invitations this family has outstanding. */
export const usePendingInvites = (backend, familyId) => {
  const [pending, setPending] = useState([]);

  useEffect(() => {
    if (!familyId) {
      setPending([]);
      return undefined;
    }
    const unsubscribe = backend.subscribeToPendingInvites(familyId, setPending, () => setPending([]));
    return () => unsubscribe();
  }, [backend, familyId]);

  return pending;
};

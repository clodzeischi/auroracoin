import { useEffect, useState } from 'react';

/** The invitation addressed to this signed-in person, if any. */
export const useInvite = (backend, email) => {
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    if (!email) {
      setInvite(null);
      return undefined;
    }
    const unsubscribe = backend.subscribeToInvite(email, setInvite, () => setInvite(null));
    return () => unsubscribe();
  }, [backend, email]);

  return invite;
};

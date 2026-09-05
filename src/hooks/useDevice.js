import { useEffect, useState } from 'react';

/**
 * The pairing record for this device: the whole of what an anonymous child
 * session is permitted to know. `null` once loading has finished means the
 * device has not been paired to a child yet.
 */
export const useDevice = (backend, uid) => {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setDevice(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = backend.subscribeToDevice(
      uid,
      (next) => {
        setDevice(next);
        setLoading(false);
      },
      () => {
        setDevice(null);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [backend, uid]);

  return { device, loading };
};

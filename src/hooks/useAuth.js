import { useCallback, useEffect, useState } from 'react';
import { getBackend } from '../data/index.js';

/**
 * `backend` is injectable so tests can drive auth transitions directly.
 */
export const useAuth = (backend = getBackend()) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = backend.subscribeToAuth((nextUser) => {
      setUser(nextUser ?? null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [backend]);

  const login = useCallback(() => backend.login(), [backend]);
  const logout = useCallback(() => backend.logout(), [backend]);

  return { user, loading, login, logout };
};

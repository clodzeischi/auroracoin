import { useLiveDoc } from './useLive.js';

/** The invitation addressed to this signed-in person, if any. */
export const useInvite = (backend, email) =>
  useLiveDoc(backend, 'subscribeToInvite', email);

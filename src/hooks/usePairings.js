import { useLiveList } from './useLive.js';

/** Pairing codes this family has outstanding but unredeemed. */
export const usePairings = (backend, familyId) =>
  useLiveList(backend, 'subscribeToPairings', familyId);

import { useLiveDoc } from './useLive.js';

/**
 * A single child document. A paired device reads its child this way rather
 * than being handed a name at pairing time, so a rename reaches the device
 * instead of leaving a stale copy on it forever.
 */
export const useChild = (backend, familyId, childId) =>
  useLiveDoc(backend, 'subscribeToChild', familyId, childId);

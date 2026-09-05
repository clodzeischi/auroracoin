import { useLiveList } from './useLive.js';

/** Invitations this family has outstanding. */
export const usePendingInvites = (backend, familyId) =>
  useLiveList(backend, 'subscribeToPendingInvites', familyId);

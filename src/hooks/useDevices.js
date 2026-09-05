import { useLiveList } from './useLive.js';

/** Every device paired into this family, so a parent can see and revoke them. */
export const useDevices = (backend, familyId) =>
  useLiveList(backend, 'subscribeToDevices', familyId);

import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export const PROJECT_ID = 'auroracoin-rules-test';

export const FAMILY = 'family-1';
export const OTHER_FAMILY = 'family-2';
export const CHILD = 'child-1';
export const SIBLING = 'child-2';

export const PARENT_UID = 'parent-uid-1';
export const CO_PARENT_UID = 'parent-uid-2';
export const STRANGER_UID = 'stranger-uid';
export const DEVICE_UID = 'device-uid-1';

export const PARENT_EMAIL = 'parent@example.com';
export const CO_PARENT_EMAIL = 'coparent@example.com';
export const STRANGER_EMAIL = 'stranger@example.com';

/** A parent: signed in with Google, so the email is verified. */
export const asParent = (env, uid = PARENT_UID, email = PARENT_EMAIL) =>
  env.authenticatedContext(uid, { email, email_verified: true }).firestore();

/** Signed in, but the email has not been verified. */
export const asUnverified = (env, uid, email) =>
  env.authenticatedContext(uid, { email, email_verified: false }).firestore();

/** A child device: anonymous, so no email claim at all. */
export const asDevice = (env, uid = DEVICE_UID) => env.authenticatedContext(uid).firestore();

export const asSignedOut = (env) => env.unauthenticatedContext().firestore();

export const minutesFromNow = (minutes) =>
  Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);

export const createTestEnv = () =>
  initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

/**
 * The world every test starts from: one family with two children and a
 * paired device on the first child, plus an unrelated second family.
 *
 * Written with rules disabled, because seeding is not what is under test.
 */
export const seed = (env) =>
  env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'families', FAMILY), {
      name: 'The Aurora House',
      createdBy: PARENT_UID,
      parentUids: [PARENT_UID],
      parents: { [PARENT_UID]: { email: PARENT_EMAIL, displayName: 'Parent' } },
    });
    await setDoc(doc(db, 'families', OTHER_FAMILY), {
      name: 'Someone Else',
      createdBy: STRANGER_UID,
      parentUids: [STRANGER_UID],
      parents: { [STRANGER_UID]: { email: STRANGER_EMAIL, displayName: 'Stranger' } },
    });

    await setDoc(doc(db, 'families', FAMILY, 'children', CHILD), { name: 'Sparrow' });
    await setDoc(doc(db, 'families', FAMILY, 'children', SIBLING), { name: 'Wren' });

    await setDoc(doc(db, 'families', FAMILY, 'children', CHILD, 'transactions', 'tx-1'), {
      amountMinor: 1000,
      comment: 'Tidied her room',
      category: 'chores',
      user: PARENT_EMAIL,
      userName: 'Parent',
      timestamp: Timestamp.fromMillis(Date.now() - 86400000),
    });
  });

/** Give DEVICE_UID a device document bound to `childId`. */
export const pairDevice = (env, childId = CHILD, familyId = FAMILY, uid = DEVICE_UID) =>
  env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'devices', uid), {
      familyId,
      childId,
      code: 'SEEDED',
      pairedAt: Timestamp.now(),
    });
  });

/** Put a pairing code in the database directly, expiry and all. */
export const seedPairing = (env, code, data) =>
  env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'pairings', code), {
      familyId: FAMILY,
      childId: CHILD,
      createdAt: Timestamp.now(),
      expiresAt: minutesFromNow(10),
      ...data,
    });
  });

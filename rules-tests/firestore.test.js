import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc,
  serverTimestamp, Timestamp, updateDoc, where, writeBatch, arrayUnion,
} from 'firebase/firestore';
import {
  createTestEnv, seed, pairDevice, seedPairing, minutesFromNow,
  asParent, asUnverified, asDevice, asSignedOut,
  FAMILY, OTHER_FAMILY, CHILD, SIBLING,
  PARENT_UID, CO_PARENT_UID, STRANGER_UID, DEVICE_UID,
  PARENT_EMAIL, CO_PARENT_EMAIL, STRANGER_EMAIL,
} from './helpers.js';

/**
 * These exercise firestore.rules against the real emulator, because the rules
 * are the whole authorization model: nothing in the client stops a hand-rolled
 * SDK call, so a rule that is subtly wrong is a silent data leak.
 */

let env;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
});

const txPath = (familyId = FAMILY, childId = CHILD) =>
  ['families', familyId, 'children', childId, 'transactions'];

const validTransaction = (overrides = {}) => ({
  amountMinor: 500,
  comment: 'Allowance',
  category: 'allowance',
  user: PARENT_EMAIL,
  userName: 'Parent',
  timestamp: serverTimestamp(),
  ...overrides,
});

describe('families', () => {
  it('lets a parent read their own family', async () => {
    await assertSucceeds(getDoc(doc(asParent(env), 'families', FAMILY)));
  });

  it('refuses a signed-out reader', async () => {
    await assertFails(getDoc(doc(asSignedOut(env), 'families', FAMILY)));
  });

  it('refuses someone who is not a parent of it', async () => {
    await assertFails(getDoc(doc(asParent(env, STRANGER_UID, STRANGER_EMAIL), 'families', FAMILY)));
  });

  it('creates a family naming only the creator as parent', async () => {
    await assertSucceeds(
      setDoc(doc(asParent(env), 'families', 'new-family'), {
        name: 'New House',
        createdBy: PARENT_UID,
        parentUids: [PARENT_UID],
        parents: { [PARENT_UID]: { email: PARENT_EMAIL, displayName: 'Parent' } },
      })
    );
  });

  it('refuses a new family that already contains someone else', async () => {
    await assertFails(
      setDoc(doc(asParent(env), 'families', 'new-family'), {
        name: 'New House',
        createdBy: PARENT_UID,
        parentUids: [PARENT_UID, STRANGER_UID],
        parents: {},
      })
    );
  });

  it('refuses a family created by an unverified email', async () => {
    await assertFails(
      setDoc(doc(asUnverified(env, 'u1', 'u1@example.com'), 'families', 'new-family'), {
        name: 'New House',
        createdBy: 'u1',
        parentUids: ['u1'],
        parents: {},
      })
    );
  });

  it('refuses a blank family name', async () => {
    await assertFails(
      setDoc(doc(asParent(env), 'families', 'new-family'), {
        name: '',
        createdBy: PARENT_UID,
        parentUids: [PARENT_UID],
        parents: {},
      })
    );
  });

  it('lets a parent rename the family', async () => {
    await assertSucceeds(updateDoc(doc(asParent(env), 'families', FAMILY), { name: 'Renamed' }));
  });

  it('refuses a parent removing themselves', async () => {
    await assertFails(
      updateDoc(doc(asParent(env), 'families', FAMILY), { parentUids: [] })
    );
  });

  it('refuses a parent removing a co-parent', async () => {
    await env.withSecurityRulesDisabled((context) =>
      updateDoc(doc(context.firestore(), 'families', FAMILY), {
        parentUids: [PARENT_UID, CO_PARENT_UID],
      })
    );
    await assertFails(
      updateDoc(doc(asParent(env), 'families', FAMILY), { parentUids: [PARENT_UID] })
    );
  });

  it('refuses reassigning who created the family', async () => {
    await assertFails(
      updateDoc(doc(asParent(env), 'families', FAMILY), { createdBy: STRANGER_UID })
    );
  });

  it('never allows deleting a family', async () => {
    await assertFails(deleteDoc(doc(asParent(env), 'families', FAMILY)));
  });
});

describe('accepting an invite', () => {
  const inviteCoParent = () =>
    env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), 'invites', CO_PARENT_EMAIL), {
        email: CO_PARENT_EMAIL,
        familyId: FAMILY,
        invitedByName: 'Parent',
      })
    );

  it('lets an invitee add themselves and consume the invite', async () => {
    await inviteCoParent();
    const db = asParent(env, CO_PARENT_UID, CO_PARENT_EMAIL);
    const batch = writeBatch(db);
    batch.update(doc(db, 'families', FAMILY), {
      parentUids: arrayUnion(CO_PARENT_UID),
      [`parents.${CO_PARENT_UID}`]: { email: CO_PARENT_EMAIL, displayName: 'Co' },
    });
    batch.delete(doc(db, 'invites', CO_PARENT_EMAIL));
    await assertSucceeds(batch.commit());
  });

  it('refuses joining a family without an invite', async () => {
    const db = asParent(env, CO_PARENT_UID, CO_PARENT_EMAIL);
    await assertFails(
      updateDoc(doc(db, 'families', FAMILY), {
        parentUids: arrayUnion(CO_PARENT_UID),
        [`parents.${CO_PARENT_UID}`]: { email: CO_PARENT_EMAIL, displayName: 'Co' },
      })
    );
  });

  it('refuses an invitee adding somebody other than themselves', async () => {
    await inviteCoParent();
    const db = asParent(env, CO_PARENT_UID, CO_PARENT_EMAIL);
    await assertFails(
      updateDoc(doc(db, 'families', FAMILY), {
        parentUids: arrayUnion(STRANGER_UID),
        [`parents.${STRANGER_UID}`]: { email: STRANGER_EMAIL, displayName: 'S' },
      })
    );
  });

  it('refuses an invitee renaming the family on the way in', async () => {
    await inviteCoParent();
    const db = asParent(env, CO_PARENT_UID, CO_PARENT_EMAIL);
    await assertFails(
      updateDoc(doc(db, 'families', FAMILY), {
        name: 'Hijacked',
        parentUids: arrayUnion(CO_PARENT_UID),
        [`parents.${CO_PARENT_UID}`]: { email: CO_PARENT_EMAIL, displayName: 'Co' },
      })
    );
  });
});

describe('invites', () => {
  it('lets a parent invite someone', async () => {
    await assertSucceeds(
      setDoc(doc(asParent(env), 'invites', CO_PARENT_EMAIL), {
        email: CO_PARENT_EMAIL,
        familyId: FAMILY,
        invitedByName: 'Parent',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('refuses inviting into a family you are not a parent of', async () => {
    await assertFails(
      setDoc(doc(asParent(env, STRANGER_UID, STRANGER_EMAIL), 'invites', CO_PARENT_EMAIL), {
        email: CO_PARENT_EMAIL,
        familyId: FAMILY,
        invitedByName: 'Stranger',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('refuses an invite whose document id is not the invited address', async () => {
    await assertFails(
      setDoc(doc(asParent(env), 'invites', CO_PARENT_EMAIL), {
        email: STRANGER_EMAIL,
        familyId: FAMILY,
        invitedByName: 'Parent',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('lets the invitee read their own invite', async () => {
    await env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), 'invites', CO_PARENT_EMAIL), {
        email: CO_PARENT_EMAIL, familyId: FAMILY, invitedByName: 'Parent',
      })
    );
    await assertSucceeds(
      getDoc(doc(asParent(env, CO_PARENT_UID, CO_PARENT_EMAIL), 'invites', CO_PARENT_EMAIL))
    );
  });

  it('refuses reading an invite addressed to somebody else', async () => {
    await env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), 'invites', CO_PARENT_EMAIL), {
        email: CO_PARENT_EMAIL, familyId: FAMILY, invitedByName: 'Parent',
      })
    );
    await assertFails(
      getDoc(doc(asParent(env, STRANGER_UID, STRANGER_EMAIL), 'invites', CO_PARENT_EMAIL))
    );
  });

  it('never allows editing an invite', async () => {
    await env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), 'invites', CO_PARENT_EMAIL), {
        email: CO_PARENT_EMAIL, familyId: FAMILY, invitedByName: 'Parent',
      })
    );
    await assertFails(
      updateDoc(doc(asParent(env), 'invites', CO_PARENT_EMAIL), { familyId: OTHER_FAMILY })
    );
  });
});

describe('children', () => {
  it('lets a parent add a child', async () => {
    await assertSucceeds(
      addDoc(collection(asParent(env), 'families', FAMILY, 'children'), {
        name: 'Robin', createdAt: serverTimestamp(),
      })
    );
  });

  it('refuses a child with an empty name', async () => {
    await assertFails(
      addDoc(collection(asParent(env), 'families', FAMILY, 'children'), {
        name: '', createdAt: serverTimestamp(),
      })
    );
  });

  it('refuses a non-parent adding a child', async () => {
    await assertFails(
      addDoc(collection(asParent(env, STRANGER_UID, STRANGER_EMAIL), 'families', FAMILY, 'children'), {
        name: 'Robin', createdAt: serverTimestamp(),
      })
    );
  });

  it('refuses a stranger reading a child', async () => {
    await assertFails(
      getDoc(doc(asParent(env, STRANGER_UID, STRANGER_EMAIL), 'families', FAMILY, 'children', CHILD))
    );
  });
});

describe('transactions', () => {
  it('lets a parent write a transaction stamped by the server', async () => {
    await assertSucceeds(
      addDoc(collection(asParent(env), ...txPath()), validTransaction())
    );
  });

  it('refuses a transaction attributed to somebody else', async () => {
    await assertFails(
      addDoc(collection(asParent(env), ...txPath()), validTransaction({ user: STRANGER_EMAIL }))
    );
  });

  it('refuses a client-chosen timestamp', async () => {
    await assertFails(
      addDoc(collection(asParent(env), ...txPath()), validTransaction({
        timestamp: Timestamp.fromMillis(0),
      }))
    );
  });

  it('refuses a non-integer amount', async () => {
    await assertFails(
      addDoc(collection(asParent(env), ...txPath()), validTransaction({ amountMinor: 10.5 }))
    );
  });

  it('refuses a zero amount', async () => {
    await assertFails(
      addDoc(collection(asParent(env), ...txPath()), validTransaction({ amountMinor: 0 }))
    );
  });

  it('refuses an unknown category', async () => {
    await assertFails(
      addDoc(collection(asParent(env), ...txPath()), validTransaction({ category: 'crypto' }))
    );
  });

  it('refuses an extra field', async () => {
    await assertFails(
      addDoc(collection(asParent(env), ...txPath()), validTransaction({ secret: 'x' }))
    );
  });

  it('lets a parent edit an entry', async () => {
    await assertSucceeds(
      updateDoc(doc(asParent(env), ...txPath(), 'tx-1'), {
        amountMinor: 2000,
        comment: 'Corrected',
        category: 'chores',
        editedBy: PARENT_EMAIL,
        editedByName: 'Parent',
        editedAt: serverTimestamp(),
      })
    );
  });

  it('refuses an edit that rewrites the original author', async () => {
    await assertFails(
      updateDoc(doc(asParent(env), ...txPath(), 'tx-1'), {
        amountMinor: 2000,
        comment: 'Corrected',
        category: 'chores',
        user: STRANGER_EMAIL,
        editedBy: PARENT_EMAIL,
        editedByName: 'Parent',
        editedAt: serverTimestamp(),
      })
    );
  });

  it('refuses an edit that moves the entry in time', async () => {
    await assertFails(
      updateDoc(doc(asParent(env), ...txPath(), 'tx-1'), {
        amountMinor: 2000,
        comment: 'Corrected',
        category: 'chores',
        timestamp: serverTimestamp(),
        editedBy: PARENT_EMAIL,
        editedByName: 'Parent',
        editedAt: serverTimestamp(),
      })
    );
  });

  it('refuses an edit attributed to somebody else', async () => {
    await assertFails(
      updateDoc(doc(asParent(env), ...txPath(), 'tx-1'), {
        amountMinor: 2000,
        comment: 'Corrected',
        category: 'chores',
        editedBy: STRANGER_EMAIL,
        editedByName: 'Stranger',
        editedAt: serverTimestamp(),
      })
    );
  });

  it('refuses a stranger reading the ledger', async () => {
    await assertFails(
      getDocs(collection(asParent(env, STRANGER_UID, STRANGER_EMAIL), ...txPath()))
    );
  });
});

describe('a paired child device', () => {
  beforeEach(() => pairDevice(env));

  it('reads the family it is paired into', async () => {
    await assertSucceeds(getDoc(doc(asDevice(env), 'families', FAMILY)));
  });

  it('reads its own child document', async () => {
    await assertSucceeds(
      getDoc(doc(asDevice(env), 'families', FAMILY, 'children', CHILD))
    );
  });

  it('reads its own ledger', async () => {
    await assertSucceeds(getDocs(collection(asDevice(env), ...txPath())));
  });

  it("refuses reading a sibling's ledger", async () => {
    await assertFails(getDocs(collection(asDevice(env), ...txPath(FAMILY, SIBLING))));
  });

  it("refuses reading a sibling's child document", async () => {
    await assertFails(
      getDoc(doc(asDevice(env), 'families', FAMILY, 'children', SIBLING))
    );
  });

  it('refuses writing a transaction', async () => {
    await assertFails(
      addDoc(collection(asDevice(env), ...txPath()), validTransaction({ user: '' }))
    );
  });

  it('refuses editing an existing transaction', async () => {
    await assertFails(
      updateDoc(doc(asDevice(env), ...txPath(), 'tx-1'), { amountMinor: 999999 })
    );
  });

  it('refuses deleting a transaction', async () => {
    await assertFails(deleteDoc(doc(asDevice(env), ...txPath(), 'tx-1')));
  });

  it('refuses renaming the family', async () => {
    await assertFails(updateDoc(doc(asDevice(env), 'families', FAMILY), { name: 'Nope' }));
  });

  it('refuses reading an unrelated family', async () => {
    await assertFails(getDoc(doc(asDevice(env), 'families', OTHER_FAMILY)));
  });

  /**
   * deleteChild is several commits on the client, so a closed tab or a dropped
   * connection can leave the device document behind. Access has to end with
   * the child regardless, which is why the rules check it rather than trusting
   * the cleanup to have finished.
   */
  describe('when its child is deleted out from under it', () => {
    beforeEach(() =>
      env.withSecurityRulesDisabled((context) =>
        deleteDoc(doc(context.firestore(), 'families', FAMILY, 'children', CHILD))
      )
    );

    it('can no longer read the family', async () => {
      await assertFails(getDoc(doc(asDevice(env), 'families', FAMILY)));
    });

    it('can no longer read the ledger, even though it still exists', async () => {
      await assertFails(getDocs(collection(asDevice(env), ...txPath())));
    });

    it('can no longer read the child document', async () => {
      await assertFails(getDoc(doc(asDevice(env), 'families', FAMILY, 'children', CHILD)));
    });
  });
});

describe('an unpaired device', () => {
  it('cannot read any family', async () => {
    await assertFails(getDoc(doc(asDevice(env, 'nobody'), 'families', FAMILY)));
  });

  it('cannot read any ledger', async () => {
    await assertFails(getDocs(collection(asDevice(env, 'nobody'), ...txPath())));
  });
});

describe('pairing codes', () => {
  const validPairing = (overrides = {}) => ({
    familyId: FAMILY,
    childId: CHILD,
    createdAt: serverTimestamp(),
    expiresAt: minutesFromNow(10),
    ...overrides,
  });

  it('lets a parent create one for their own child', async () => {
    await assertSucceeds(setDoc(doc(asParent(env), 'pairings', 'ABC123'), validPairing()));
  });

  it('refuses a code for a child in another family', async () => {
    await assertFails(
      setDoc(doc(asParent(env), 'pairings', 'ABC123'),
        validPairing({ familyId: OTHER_FAMILY }))
    );
  });

  it('refuses a code for a child that does not exist', async () => {
    await assertFails(
      setDoc(doc(asParent(env), 'pairings', 'ABC123'), validPairing({ childId: 'ghost' }))
    );
  });

  it('refuses a code from someone who is not a parent', async () => {
    await assertFails(
      setDoc(doc(asParent(env, STRANGER_UID, STRANGER_EMAIL), 'pairings', 'ABC123'),
        validPairing())
    );
  });

  it('refuses a code that would never expire', async () => {
    await assertFails(
      setDoc(doc(asParent(env), 'pairings', 'ABC123'),
        validPairing({ expiresAt: minutesFromNow(60 * 24 * 365) }))
    );
  });

  it('refuses a code that is already expired', async () => {
    await assertFails(
      setDoc(doc(asParent(env), 'pairings', 'ABC123'),
        validPairing({ expiresAt: minutesFromNow(-1) }))
    );
  });

  it('lets an anonymous device fetch a code by id', async () => {
    await seedPairing(env, 'ABC123');
    await assertSucceeds(getDoc(doc(asDevice(env), 'pairings', 'ABC123')));
  });

  it('refuses listing codes, so they cannot be enumerated', async () => {
    await seedPairing(env, 'ABC123');
    await assertFails(getDocs(collection(asDevice(env), 'pairings')));
  });

  it('lets a parent list the codes outstanding for their family', async () => {
    await seedPairing(env, 'ABC123');
    await assertSucceeds(
      getDocs(query(collection(asParent(env), 'pairings'), where('familyId', '==', FAMILY)))
    );
  });

  it('lets a parent cancel a code', async () => {
    await seedPairing(env, 'ABC123');
    await assertSucceeds(deleteDoc(doc(asParent(env), 'pairings', 'ABC123')));
  });

  // A code may be destroyed by anyone who can name it, which is the price of
  // consuming it atomically as part of redemption - see the rule's comment.
  // The guarantee that matters is that holding a code grants nothing beyond
  // pairing the one child it names, which the redemption tests below pin down.
  it('refuses a signed-out caller cancelling a code', async () => {
    await seedPairing(env, 'ABC123');
    await assertFails(deleteDoc(doc(asSignedOut(env), 'pairings', 'ABC123')));
  });
});

describe('redeeming a pairing code', () => {
  const claim = (db, code, overrides = {}) =>
    setDoc(doc(db, 'devices', DEVICE_UID), {
      familyId: FAMILY,
      childId: CHILD,
      code,
      pairedAt: serverTimestamp(),
      ...overrides,
    });

  it('pairs a device and consumes the code in one batch', async () => {
    await seedPairing(env, 'ABC123');
    const db = asDevice(env);
    const batch = writeBatch(db);
    batch.set(doc(db, 'devices', DEVICE_UID), {
      familyId: FAMILY, childId: CHILD, code: 'ABC123', pairedAt: serverTimestamp(),
    });
    batch.delete(doc(db, 'pairings', 'ABC123'));
    await assertSucceeds(batch.commit());
  });

  it('refuses a code that does not exist', async () => {
    await assertFails(claim(asDevice(env), 'NOPE99'));
  });

  it('refuses an expired code', async () => {
    await seedPairing(env, 'OLD123', { expiresAt: minutesFromNow(-5) });
    await assertFails(claim(asDevice(env), 'OLD123'));
  });

  it('refuses pointing the device at a child the code is not for', async () => {
    await seedPairing(env, 'ABC123');
    await assertFails(claim(asDevice(env), 'ABC123', { childId: SIBLING }));
  });

  it('refuses pointing the device at another family', async () => {
    await seedPairing(env, 'ABC123');
    await assertFails(claim(asDevice(env), 'ABC123', { familyId: OTHER_FAMILY }));
  });

  it('refuses writing a device document for somebody else', async () => {
    await seedPairing(env, 'ABC123');
    const db = asDevice(env);
    await assertFails(
      setDoc(doc(db, 'devices', 'another-uid'), {
        familyId: FAMILY, childId: CHILD, code: 'ABC123', pairedAt: serverTimestamp(),
      })
    );
  });

  it('refuses a device document with a client-chosen pairing time', async () => {
    await seedPairing(env, 'ABC123');
    await assertFails(claim(asDevice(env), 'ABC123', { pairedAt: Timestamp.fromMillis(0) }));
  });

  it('never lets a paired device repoint itself at a sibling', async () => {
    await pairDevice(env);
    await seedPairing(env, 'ABC123', { childId: SIBLING });
    await assertFails(
      updateDoc(doc(asDevice(env), 'devices', DEVICE_UID), { childId: SIBLING })
    );
  });
});

describe('device documents', () => {
  beforeEach(() => pairDevice(env));

  it('lets a device read its own', async () => {
    await assertSucceeds(getDoc(doc(asDevice(env), 'devices', DEVICE_UID)));
  });

  it('refuses another device reading it', async () => {
    await assertFails(getDoc(doc(asDevice(env, 'other-device'), 'devices', DEVICE_UID)));
  });

  it('lets a parent list the devices in their family', async () => {
    await assertSucceeds(
      getDocs(query(collection(asParent(env), 'devices'), where('familyId', '==', FAMILY)))
    );
  });

  it('refuses a stranger listing them', async () => {
    await assertFails(
      getDocs(query(collection(asParent(env, STRANGER_UID, STRANGER_EMAIL), 'devices'),
        where('familyId', '==', FAMILY)))
    );
  });

  it('lets a parent unpair a device', async () => {
    await assertSucceeds(deleteDoc(doc(asParent(env), 'devices', DEVICE_UID)));
  });

  it('lets a device retire itself', async () => {
    await assertSucceeds(deleteDoc(doc(asDevice(env), 'devices', DEVICE_UID)));
  });

  it('refuses a stranger unpairing it', async () => {
    await assertFails(
      deleteDoc(doc(asParent(env, STRANGER_UID, STRANGER_EMAIL), 'devices', DEVICE_UID))
    );
  });
});

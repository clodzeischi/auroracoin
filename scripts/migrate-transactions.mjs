#!/usr/bin/env node
/**
 * One-time migration of the `transactions` collection:
 *
 *   amount: 10   ->  amountMinor: 1000     (whole coins -> hundredths)
 *   (no category) -> category: <suggested or 'uncategorized'>
 *
 * This is NOT required for the app to work. The read path already treats a
 * legacy `amount` as whole coins, so balances, the dashboard and the ledger
 * are correct without it. What it unlocks is *editing* old entries: the
 * security rules pin the exact field set, so a document still carrying the
 * old `amount` field is rejected on update.
 *
 * Runs as a dry run by default and prints what it would change.
 *
 *   node scripts/migrate-transactions.mjs              # preview
 *   node scripts/migrate-transactions.mjs --apply      # write
 *
 * Requires firebase-admin and credentials for the project:
 *   yarn add -D firebase-admin
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */
import { suggestCategory } from '../src/analytics/suggestCategory.js';

const APPLY = process.argv.includes('--apply');
const COLLECTION = 'transactions';

let admin;
try {
  admin = await import('firebase-admin/app');
} catch {
  console.error(
    'firebase-admin is not installed.\n' +
    '  yarn add -D firebase-admin\n' +
    '  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json'
  );
  process.exit(1);
}

const { initializeApp, applicationDefault } = admin;
const { getFirestore } = await import('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const snapshot = await db.collection(COLLECTION).get();
console.log(`${snapshot.size} document(s) in ${COLLECTION}\n`);

const planned = [];
let alreadyDone = 0;

snapshot.forEach((doc) => {
  const data = doc.data();
  const needsAmount = data.amountMinor === undefined && typeof data.amount === 'number';
  const needsCategory = data.category === undefined;

  if (!needsAmount && !needsCategory) {
    alreadyDone += 1;
    return;
  }

  const amountMinor = needsAmount ? Math.round(data.amount * 100) : data.amountMinor;
  const category = needsCategory
    ? suggestCategory(data.comment, amountMinor) ?? 'uncategorized'
    : data.category;

  planned.push({ id: doc.id, amountMinor, category, needsAmount, comment: data.comment ?? '' });
});

for (const item of planned) {
  const money = (item.amountMinor / 100).toFixed(2);
  const guessed = item.category === 'uncategorized' ? '  <- needs a human' : '';
  console.log(`  ${item.id}  ${money.padStart(10)}  ${item.category.padEnd(14)}${guessed}  ${item.comment}`);
}

console.log(
  `\n${planned.length} to change, ${alreadyDone} already migrated.` +
  `\n${planned.filter((p) => p.category === 'uncategorized').length} could not be categorised automatically.`
);

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to write these changes.');
  process.exit(0);
}

const batch = db.batch();
for (const item of planned) {
  const update = { category: item.category };
  if (item.needsAmount) {
    update.amountMinor = item.amountMinor;
    update.amount = (await import('firebase-admin/firestore')).FieldValue.delete();
  }
  batch.update(db.collection(COLLECTION).doc(item.id), update);
}
await batch.commit();
console.log(`\nApplied ${planned.length} update(s).`);

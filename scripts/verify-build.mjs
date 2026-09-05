#!/usr/bin/env node
/**
 * Guards the promise that a deployed bundle never contains mock data.
 * Run after `yarn build`. Exits non-zero if any mock artefact survived.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ASSET_DIR = 'dist/assets';
const FORBIDDEN = [
  ['mock seed data', 'Tidied her room'],
  ['mock backend factory', 'createMockBackend'],
  ['mock data banner', 'Mock data'],
];

let files;
try {
  files = readdirSync(ASSET_DIR).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`verify-build: ${ASSET_DIR} not found. Run \`yarn build\` first.`);
  process.exit(1);
}

const bundle = files.map((f) => readFileSync(join(ASSET_DIR, f), 'utf8')).join('\n');
const leaked = FORBIDDEN.filter(([, needle]) => bundle.includes(needle));

if (leaked.length > 0) {
  console.error('verify-build: FAILED - mock artefacts found in production bundle:');
  leaked.forEach(([label]) => console.error(`  - ${label}`));
  process.exit(1);
}

console.log(`verify-build: OK - no mock artefacts in ${files.length} bundled file(s).`);

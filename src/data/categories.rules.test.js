import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALL_CATEGORY_IDS } from './categories.js';

/**
 * The category enum exists twice: once in JS for the UI, once in
 * firestore.rules for server-side validation. They cannot import each other,
 * so this asserts they have not drifted - a category the UI offers but the
 * rules reject would fail every write with a bare permission error.
 */
describe('category enum parity with firestore.rules', () => {
  const rules = readFileSync('firestore.rules', 'utf8');

  it.each(ALL_CATEGORY_IDS)('rules accept the "%s" category', (id) => {
    expect(rules).toContain(`'${id}'`);
  });

  it('rules define no category the UI cannot produce', () => {
    const block = rules.match(/function isValidCategory[\s\S]*?\n {4}}/)[0];
    const inRules = [...block.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(inRules.sort()).toEqual([...ALL_CATEGORY_IDS].sort());
  });
});

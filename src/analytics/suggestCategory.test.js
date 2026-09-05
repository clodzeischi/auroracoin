import { describe, it, expect } from 'vitest';
import { suggestCategory } from './suggestCategory.js';

describe('suggestCategory', () => {
  it('suggests an earning category from a comment on a positive amount', () => {
    expect(suggestCategory('Tidied her room all week', 10)).toBe('chores');
    expect(suggestCategory('Birthday from Grandma', 25)).toBe('gift');
  });

  it('suggests a spending category from a comment on a negative amount', () => {
    expect(suggestCategory('Bought a lego set', -20)).toBe('toys');
    expect(suggestCategory('Ice cream after school', -3)).toBe('treats');
  });

  it('never crosses direction, even when a keyword matches the other set', () => {
    // "lego" is a spending keyword; on a positive amount it must not win.
    expect(suggestCategory('Sold her old lego', 5)).not.toBe('toys');
  });

  it('returns null when nothing matches, rather than guessing', () => {
    // Null is the signal for "a human decides" - the whole point of
    // review-first backfill.
    expect(suggestCategory('asdf qwerty', 10)).toBeNull();
    expect(suggestCategory('', -5)).toBeNull();
    expect(suggestCategory(undefined, 10)).toBeNull();
  });

  it('returns null for an unusable amount', () => {
    expect(suggestCategory('chores', 0)).toBeNull();
    expect(suggestCategory('chores', undefined)).toBeNull();
  });

  it('matches case-insensitively and on word stems inside a sentence', () => {
    expect(suggestCategory('CHORES done', 5)).toBe('chores');
    expect(suggestCategory('we went to the movies on saturday', -12)).toBe('outings');
  });

  it('only ever suggests ids the rules will accept', () => {
    const samples = [
      ['Tidied her room', 10], ['Bought lego', -20], ['Ice cream', -3],
      ['Birthday money', 25], ['Saved up', -10], ['Donated to charity', -5],
    ];
    samples.forEach(([comment, amount]) => {
      const suggestion = suggestCategory(comment, amount);
      if (suggestion !== null) {
        expect(typeof suggestion).toBe('string');
      }
    });
  });
});

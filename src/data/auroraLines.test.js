import { describe, expect, it } from 'vitest';
import { auroraFacts, auroraLinesFor, pickAuroraLine } from './auroraLines.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-23T12:00:00Z');
const ago = (days) => new Date(NOW.getTime() - days * DAY);

const tx = (amountMinor, category, days = 1, comment = '') => ({
  amountMinor,
  category,
  comment,
  timestamp: ago(days),
});

describe('auroraFacts', () => {
  it('sums the balance over every transaction, whatever its age', () => {
    const facts = auroraFacts([tx(2500, 'gift', 400), tx(-450, 'treats', 2)], NOW);
    expect(facts.balanceMinor).toBe(2050);
    expect(facts.count).toBe(2);
  });

  it('counts only the last seven days towards the week', () => {
    const facts = auroraFacts([tx(1000, 'chores', 2), tx(5000, 'gift', 30)], NOW);
    expect(facts.earnedWeekMinor).toBe(1000);
  });

  it('names the busiest category in each direction by total, not by count', () => {
    const facts = auroraFacts(
      [tx(-100, 'games', 1), tx(-100, 'games', 2), tx(-900, 'books', 3), tx(500, 'chores', 1)],
      NOW
    );
    expect(facts.topSpent).toBe('books');
    expect(facts.topEarned).toBe('chores');
  });

  it('ignores malformed amounts rather than poisoning the balance', () => {
    const facts = auroraFacts([tx(1000, 'gift'), { amountMinor: NaN }, { amountMinor: 0 }], NOW);
    expect(facts.balanceMinor).toBe(1000);
    expect(facts.count).toBe(1);
  });
});

describe('the pool of lines', () => {
  it('is never empty, even for a ledger with nothing in it', () => {
    const lines = auroraLinesFor(auroraFacts([], NOW));
    expect(lines.length).toBeGreaterThan(0);
    expect(pickAuroraLine(auroraFacts([], NOW), 0)).not.toBeNull();
  });

  it('only offers lines the ledger actually supports', () => {
    // Nothing was spent, so no spending-category line may appear.
    const facts = auroraFacts([tx(1000, 'chores', 2)], NOW);
    const ids = auroraLinesFor(facts).map((line) => line.id);
    expect(ids).toContain('chores');
    expect(ids).toContain('saving-week');
    expect(ids).not.toContain('treats');
    expect(ids).not.toContain('spendy-week');
    expect(ids).not.toContain('empty');
  });

  it('says how far ahead a good week is, in coins', () => {
    const facts = auroraFacts([tx(3500, 'chores', 2), tx(-450, 'treats', 1)], NOW);
    const good = auroraLinesFor(facts).find((line) => line.id === 'good-week');
    expect(good.text).toContain('30.50');
  });

  it('picks a different line as the roll moves across the range', () => {
    const facts = auroraFacts([tx(2500, 'gift', 2), tx(-450, 'treats', 1)], NOW);
    const picked = new Set([0, 0.34, 0.67, 0.99].map((roll) => pickAuroraLine(facts, roll).id));
    expect(picked.size).toBeGreaterThan(1);
  });

  it('keeps a roll of exactly 1 inside the pool', () => {
    const facts = auroraFacts([tx(2500, 'gift', 2)], NOW);
    expect(pickAuroraLine(facts, 1)).not.toBeUndefined();
    expect(pickAuroraLine(facts, 1)).not.toBeNull();
  });

  it('gives every line a sprite that exists', () => {
    const facts = auroraFacts([tx(2500, 'gift', 2), tx(-450, 'treats', 1)], NOW);
    for (const line of auroraLinesFor(facts)) {
      expect(['hi', 'idle', 'talk', 'wink']).toContain(line.mood);
    }
  });
});

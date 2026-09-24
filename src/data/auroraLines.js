import { formatMinor } from '../utils/money.js';
import { UNCATEGORIZED, isValidCategory } from '../data/categories.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * What Aurora knows about a child's ledger, reduced to plain numbers.
 *
 * Kept apart from the lines themselves so a new line is a one-line change to
 * a list rather than a change to a screen, and so the whole pool can be
 * tested against fabricated facts without rendering anything.
 */
export function auroraFacts(transactions, now = new Date()) {
  const weekStart = new Date(now.getTime() - 7 * DAY);
  const earnedBy = new Map();
  const spentBy = new Map();

  let count = 0;
  let balanceMinor = 0;
  let earnedWeekMinor = 0;
  let spentWeekMinor = 0;
  let latest = null;

  for (const transaction of transactions) {
    const amount = transaction.amountMinor;
    if (!Number.isFinite(amount) || amount === 0) continue;

    count += 1;
    balanceMinor += amount;

    const category = isValidCategory(transaction.category)
      ? transaction.category
      : UNCATEGORIZED;
    const bucket = amount > 0 ? earnedBy : spentBy;
    bucket.set(category, (bucket.get(category) ?? 0) + Math.abs(amount));

    if (transaction.timestamp instanceof Date) {
      if (transaction.timestamp >= weekStart) {
        if (amount > 0) earnedWeekMinor += amount;
        else spentWeekMinor += -amount;
      }
      if (!latest || transaction.timestamp > latest.timestamp) latest = transaction;
    }
  }

  const busiest = (totals) =>
    [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    count,
    balanceMinor,
    earnedWeekMinor,
    spentWeekMinor,
    topEarned: busiest(earnedBy),
    topSpent: busiest(spentBy),
    latestComment: typeof latest?.comment === 'string' ? latest.comment.trim() : '',
  };
}

/**
 * Everything Aurora could say, with the condition that makes each one true.
 *
 * She only ever says something the ledger supports - a line that guesses is
 * worse than no line, because a child checks it against what they remember
 * doing. `mood` picks the sprite, so the face agrees with the sentence.
 */
const LINES = [
  // --- the week, when there is one ---
  {
    id: 'good-week',
    mood: 'hi',
    when: (f) => f.earnedWeekMinor > f.spentWeekMinor && f.spentWeekMinor > 0,
    text: (f) =>
      `Looks like you're doing very well this week! You earned ${formatMinor(
        f.earnedWeekMinor - f.spentWeekMinor
      )} more coins than you spent.`,
  },
  {
    id: 'saving-week',
    mood: 'wink',
    when: (f) => f.earnedWeekMinor > 0 && f.spentWeekMinor === 0,
    text: (f) =>
      `You earned ${formatMinor(
        f.earnedWeekMinor
      )} coins this week and haven't spent any of them. Saving up for something?`,
  },
  {
    id: 'spendy-week',
    mood: 'talk',
    when: (f) => f.spentWeekMinor > f.earnedWeekMinor,
    text: (f) =>
      `You spent ${formatMinor(
        f.spentWeekMinor - f.earnedWeekMinor
      )} more coins than you earned this week. That happens to me too!`,
  },

  // --- what they spend it on ---
  { id: 'treats', mood: 'wink', when: (f) => f.topSpent === 'treats',
    text: () => 'Looks like you really like treats! Me too.' },
  { id: 'books', mood: 'hi', when: (f) => f.topSpent === 'books',
    text: () => "You've been buying books. Is the last one any good?" },
  { id: 'games', mood: 'talk', when: (f) => f.topSpent === 'games',
    text: () => 'Games again! What are you playing at the moment?' },
  { id: 'toys', mood: 'hi', when: (f) => f.topSpent === 'toys',
    text: () => 'New toys! What did you pick in the end?' },
  { id: 'outings', mood: 'talk', when: (f) => f.topSpent === 'outings',
    text: () => "You've been out and about. Where did you go?" },
  { id: 'savings', mood: 'wink', when: (f) => f.topSpent === 'savings',
    text: () => "Putting coins away into savings - that's the clever move." },
  { id: 'giving', mood: 'hi', when: (f) => f.topSpent === 'giving',
    text: () => 'You gave some of your coins away. That was a kind thing to do.' },

  // --- where it comes from ---
  { id: 'chores', mood: 'talk', when: (f) => f.topEarned === 'chores',
    text: () => 'All those chores really add up, don’t they?' },
  { id: 'allowance', mood: 'hi', when: (f) => f.topEarned === 'allowance',
    text: () => 'Allowance day might be the best day of the week.' },
  { id: 'gift', mood: 'wink', when: (f) => f.topEarned === 'gift',
    text: () => 'Somebody gave you a gift! Lucky you.' },
  { id: 'bonus', mood: 'hi', when: (f) => f.topEarned === 'bonus',
    text: () => 'A bonus! You must have done something impressive.' },
  { id: 'school', mood: 'talk', when: (f) => f.topEarned === 'school',
    text: () => 'Coins for school work. That is the good kind of earning.' },

  // --- always available, so the pool is never empty ---
  { id: 'empty', mood: 'hi', when: (f) => f.count === 0,
    text: () => 'Your ledger is empty for now. The very first coin is the exciting one!' },
  { id: 'proud', mood: 'hi', when: (f) => f.count > 0,
    text: () => 'Every coin in here is one you actually earned. That counts for a lot.' },
  { id: 'keeping-count', mood: 'idle', when: (f) => f.count > 0,
    text: (f) => `I've been keeping count for you - ${f.count} ${f.count === 1 ? 'entry' : 'entries'} so far.` },
];

/** Every line that is true of these facts right now. */
export function auroraLinesFor(facts) {
  return LINES.filter((line) => line.when(facts)).map((line) => ({
    id: line.id,
    mood: line.mood,
    text: line.text(facts),
  }));
}

/**
 * One line, chosen by `roll` - a number in [0, 1). Taking the roll as an
 * argument rather than calling Math.random() here is what lets a test pin the
 * choice, and lets the caller hold one roll still for the length of a visit.
 */
export function pickAuroraLine(facts, roll = Math.random()) {
  const applicable = auroraLinesFor(facts);
  if (applicable.length === 0) return null;
  const index = Math.min(Math.floor(roll * applicable.length), applicable.length - 1);
  return applicable[index];
}

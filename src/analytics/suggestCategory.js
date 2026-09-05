import { EARNING_CATEGORIES, SPENDING_CATEGORIES } from '../data/categories.js';

/**
 * Keyword hints for a ONE-TIME backfill of transactions written before
 * categories existed. Deliberately not used at runtime: the form asks a human,
 * because a wrong category is invisible once it is in a chart.
 *
 * Returns null whenever it is not confident, which is the signal to ask.
 */
const HINTS = {
  chores: ['chore', 'room', 'tidy', 'tidied', 'clean', 'dish', 'laundry', 'trash', 'vacuum'],
  allowance: ['allowance', 'weekly', 'pocket money'],
  gift: ['birthday', 'christmas', 'grandma', 'grandpa', 'present', 'gift'],
  bonus: ['bonus', 'reward', 'extra', 'good job', 'well done'],
  school: ['school', 'grade', 'homework', 'reading', 'test', 'spelling'],

  toys: ['toy', 'lego', 'doll', 'figure', 'puzzle'],
  games: ['game', 'roblox', 'minecraft', 'video game', 'app'],
  books: ['book', 'comic', 'magazine'],
  treats: ['candy', 'ice cream', 'sweet', 'snack', 'sticker', 'treat', 'chocolate'],
  outings: ['movie', 'cinema', 'zoo', 'park', 'trip', 'outing', 'museum'],
  savings: ['save', 'saved', 'saving', 'bank'],
  giving: ['charity', 'donate', 'donation', 'giving'],
};

const EARNING_IDS = EARNING_CATEGORIES.map((c) => c.id);
const SPENDING_IDS = SPENDING_CATEGORIES.map((c) => c.id);

export function suggestCategory(comment, amount) {
  if (!Number.isFinite(amount) || amount === 0) return null;
  if (typeof comment !== 'string' || comment.trim() === '') return null;

  const haystack = comment.toLowerCase();
  // Direction is authoritative: a spending keyword can never win on income.
  const candidates = amount > 0 ? EARNING_IDS : SPENDING_IDS;

  for (const id of candidates) {
    if ((HINTS[id] ?? []).some((keyword) => haystack.includes(keyword))) {
      return id;
    }
  }
  return null;
}

/**
 * Categories are direction-specific: "Chores" is never a way to spend coins.
 * Ids are stable and stored; labels are display-only and safe to reword.
 */
export const EARNING_CATEGORIES = [
  { id: 'chores', label: 'Chores' },
  { id: 'allowance', label: 'Allowance' },
  { id: 'gift', label: 'Gift' },
  { id: 'bonus', label: 'Bonus' },
  { id: 'school', label: 'School' },
];

export const SPENDING_CATEGORIES = [
  { id: 'toys', label: 'Toys' },
  { id: 'games', label: 'Games' },
  { id: 'books', label: 'Books' },
  { id: 'treats', label: 'Treats' },
  { id: 'outings', label: 'Outings' },
  { id: 'savings', label: 'Savings' },
  { id: 'giving', label: 'Giving' },
];

export const UNCATEGORIZED = 'uncategorized';

export const ALL_CATEGORY_IDS = [
  ...EARNING_CATEGORIES.map((c) => c.id),
  ...SPENDING_CATEGORIES.map((c) => c.id),
  UNCATEGORIZED,
];

const LABELS = new Map(
  [...EARNING_CATEGORIES, ...SPENDING_CATEGORIES].map((c) => [c.id, c.label])
);

/** The list a form should offer, given the amount typed so far. */
export const categoriesForAmount = (amount) => {
  if (!Number.isFinite(amount) || amount === 0) return [];
  return amount > 0 ? EARNING_CATEGORIES : SPENDING_CATEGORIES;
};

export const isValidCategory = (id) => ALL_CATEGORY_IDS.includes(id);

export const categoryLabel = (id) => LABELS.get(id) ?? 'Uncategorized';

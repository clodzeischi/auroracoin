import { describe, it, expect } from 'vitest';
import {
  EARNING_CATEGORIES,
  SPENDING_CATEGORIES,
  UNCATEGORIZED,
  ALL_CATEGORY_IDS,
  categoriesForAmount,
  categoryLabel,
  isValidCategory,
} from './categories.js';

describe('categories', () => {
  it('offers earning categories for a positive amount', () => {
    expect(categoriesForAmount(10)).toEqual(EARNING_CATEGORIES);
  });

  it('offers spending categories for a negative amount', () => {
    expect(categoriesForAmount(-10)).toEqual(SPENDING_CATEGORIES);
  });

  it('offers nothing for an amount that is not yet a usable number', () => {
    // The form asks for a category while the amount field may still be empty.
    expect(categoriesForAmount(0)).toEqual([]);
    expect(categoriesForAmount(NaN)).toEqual([]);
    expect(categoriesForAmount(undefined)).toEqual([]);
  });

  it('keeps earning and spending sets disjoint', () => {
    const earning = EARNING_CATEGORIES.map((c) => c.id);
    const spending = SPENDING_CATEGORIES.map((c) => c.id);
    expect(earning.filter((id) => spending.includes(id))).toEqual([]);
  });

  it('uses stable machine ids distinct from display labels', () => {
    [...EARNING_CATEGORIES, ...SPENDING_CATEGORIES].forEach((category) => {
      expect(category.id).toMatch(/^[a-z]+$/);
      expect(category.label).toEqual(expect.any(String));
    });
  });

  it('exposes every id, including uncategorized, for rule and backfill use', () => {
    expect(ALL_CATEGORY_IDS).toContain('chores');
    expect(ALL_CATEGORY_IDS).toContain('toys');
    expect(ALL_CATEGORY_IDS).toContain(UNCATEGORIZED);
  });

  it('validates ids against the known set', () => {
    expect(isValidCategory('chores')).toBe(true);
    expect(isValidCategory(UNCATEGORIZED)).toBe(true);
    expect(isValidCategory('crypto')).toBe(false);
    expect(isValidCategory(undefined)).toBe(false);
  });

  it('labels a known id and falls back readably for an unknown one', () => {
    expect(categoryLabel('chores')).toBe('Chores');
    expect(categoryLabel(UNCATEGORIZED)).toBe('Uncategorized');
    expect(categoryLabel('mystery')).toBe('Uncategorized');
    expect(categoryLabel(undefined)).toBe('Uncategorized');
  });
});

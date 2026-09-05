import { describe, it, expect } from 'vitest';
import { shouldUseMockData } from './env.js';

describe('shouldUseMockData', () => {
  it('never mocks in a production build, even when the flag explicitly asks for mocks', () => {
    // The safety property that matters: a deployed bundle can never ship fake data,
    // no matter what leaks into the build environment.
    expect(shouldUseMockData({ PROD: true, DEV: false, VITE_USE_MOCK_DATA: 'true' })).toBe(false);
  });

  it('uses mock data by default while prototyping locally', () => {
    expect(shouldUseMockData({ PROD: false, DEV: true })).toBe(true);
  });

  it('lets a developer opt out to exercise the real Firestore locally', () => {
    expect(
      shouldUseMockData({ PROD: false, DEV: true, VITE_USE_MOCK_DATA: 'false' })
    ).toBe(false);
  });

  it('lets a developer opt in explicitly', () => {
    expect(
      shouldUseMockData({ PROD: false, DEV: true, VITE_USE_MOCK_DATA: 'true' })
    ).toBe(true);
  });

  it('ignores an unparseable flag value rather than guessing', () => {
    expect(
      shouldUseMockData({ PROD: false, DEV: true, VITE_USE_MOCK_DATA: 'yes please' })
    ).toBe(true);
    expect(
      shouldUseMockData({ PROD: false, DEV: false, VITE_USE_MOCK_DATA: 'banana' })
    ).toBe(false);
  });

  it('does not mock when neither DEV nor PROD is set', () => {
    expect(shouldUseMockData({})).toBe(false);
  });
});

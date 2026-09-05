import { describe, it, expect } from 'vitest';
import {
  PAIRING_CODE_LENGTH,
  PAIRING_TTL_MINUTES,
  generatePairingCode,
  isWellFormedCode,
  normalizePairingCode,
  pairingExpiry,
} from './pairing.js';

describe('generatePairingCode', () => {
  const codes = Array.from({ length: 200 }, generatePairingCode);

  it('is the length the UI and the rules both expect', () => {
    codes.forEach((code) => expect(code).toHaveLength(PAIRING_CODE_LENGTH));
  });

  /**
   * The whole point of the restricted alphabet: a code is read aloud and
   * typed by a child, so a character that can be misheard or misread is a
   * support problem rather than a security one.
   */
  it('never contains a character that is confusable when read out', () => {
    codes.forEach((code) => expect(code).not.toMatch(/[ILO01]/));
  });

  it('is upper case and alphanumeric throughout', () => {
    codes.forEach((code) => expect(code).toMatch(/^[A-Z2-9]+$/));
  });

  it('does not repeat itself over a realistic number of families', () => {
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('produces codes it considers well formed', () => {
    codes.forEach((code) => expect(isWellFormedCode(code)).toBe(true));
  });
});

describe('normalizePairingCode', () => {
  it('upper-cases what a child typed in lower case', () => {
    expect(normalizePairingCode('abc234')).toBe('ABC234');
  });

  it('drops the spaces and dashes people add while reading aloud', () => {
    expect(normalizePairingCode('ABC - 234')).toBe('ABC234');
    expect(normalizePairingCode(' abc 234 ')).toBe('ABC234');
  });

  it('survives nothing at all', () => {
    expect(normalizePairingCode(null)).toBe('');
    expect(normalizePairingCode(undefined)).toBe('');
  });
});

describe('isWellFormedCode', () => {
  it('rejects the wrong length', () => {
    expect(isWellFormedCode('ABC23')).toBe(false);
    expect(isWellFormedCode('ABC2345')).toBe(false);
  });

  it('rejects the characters deliberately left out of the alphabet', () => {
    expect(isWellFormedCode('ABC23I')).toBe(false);
    expect(isWellFormedCode('ABC230')).toBe(false);
  });

  it('rejects anything that is not a string', () => {
    expect(isWellFormedCode(null)).toBe(false);
    expect(isWellFormedCode(234567)).toBe(false);
  });
});

describe('pairingExpiry', () => {
  it('is the advertised number of minutes ahead of the moment it is made', () => {
    const from = Date.parse('2026-09-05T12:00:00Z');
    expect(pairingExpiry(from).toISOString()).toBe('2026-09-05T12:10:00.000Z');
    expect(PAIRING_TTL_MINUTES).toBe(10);
  });
});

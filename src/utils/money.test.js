import { describe, it, expect } from 'vitest';
import { parseAmountInput, formatMinor, formatMinorSigned } from './money.js';

describe('parseAmountInput', () => {
  it('reads whole and decimal amounts as hundredths', () => {
    expect(parseAmountInput('10')).toBe(1000);
    expect(parseAmountInput('10.5')).toBe(1050);
    expect(parseAmountInput('10.50')).toBe(1050);
    expect(parseAmountInput('0.05')).toBe(5);
  });

  it('parses without ever multiplying a float', () => {
    // 10.07 * 100 === 1006.9999999999999 in IEEE 754. Parsing the digits
    // separately is the only way this lands on exactly 1007.
    expect(parseAmountInput('10.07')).toBe(1007);
    expect(parseAmountInput('0.29')).toBe(29);
    expect(parseAmountInput('1.15')).toBe(115);
  });

  it('accepts negatives, so coins can be spent', () => {
    expect(parseAmountInput('-4.25')).toBe(-425);
    expect(parseAmountInput('-0.01')).toBe(-1);
  });

  it('accepts a leading decimal point', () => {
    expect(parseAmountInput('.5')).toBe(50);
  });

  it('trims surrounding whitespace', () => {
    expect(parseAmountInput('  10.50  ')).toBe(1050);
  });

  it('refuses more than two decimal places rather than rounding silently', () => {
    expect(parseAmountInput('10.505')).toBeNull();
    expect(parseAmountInput('0.001')).toBeNull();
  });

  it('refuses zero in any spelling', () => {
    expect(parseAmountInput('0')).toBeNull();
    expect(parseAmountInput('0.00')).toBeNull();
    expect(parseAmountInput('-0.00')).toBeNull();
  });

  it('refuses anything that is not a plain decimal number', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('   ')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('10abc')).toBeNull();
    expect(parseAmountInput('10.')).toBeNull();
    expect(parseAmountInput('-')).toBeNull();
    expect(parseAmountInput('.')).toBeNull();
    expect(parseAmountInput('1e2')).toBeNull();
    expect(parseAmountInput('1,50')).toBeNull();
    expect(parseAmountInput(undefined)).toBeNull();
  });
});

describe('formatMinor', () => {
  it('always shows two decimal places', () => {
    expect(formatMinor(1000)).toBe('10.00');
    expect(formatMinor(1050)).toBe('10.50');
    expect(formatMinor(1007)).toBe('10.07');
    expect(formatMinor(5)).toBe('0.05');
    expect(formatMinor(0)).toBe('0.00');
  });

  it('formats negatives with the minus in front of the whole figure', () => {
    expect(formatMinor(-425)).toBe('-4.25');
    expect(formatMinor(-1)).toBe('-0.01');
  });

  it('round-trips through the parser', () => {
    [1, -1, 5, 1007, -425, 99999].forEach((minor) => {
      expect(parseAmountInput(formatMinor(minor))).toBe(minor);
    });
  });

  it('returns a dash for a value that is not a number', () => {
    expect(formatMinor(undefined)).toBe('—');
    expect(formatMinor(NaN)).toBe('—');
  });
});

describe('formatMinorSigned', () => {
  it('marks gains with a plus so direction reads at a glance', () => {
    expect(formatMinorSigned(1050)).toBe('+10.50');
    expect(formatMinorSigned(-425)).toBe('-4.25');
    expect(formatMinorSigned(0)).toBe('0.00');
  });
});

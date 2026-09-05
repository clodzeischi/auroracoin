/**
 * Money is stored and summed as an integer number of hundredths ("minor
 * units"), never as a float. Summing floats accumulates error - add 0.1 ten
 * times and you get 0.9999999999999999 - which in a ledger eventually shows a
 * balance that is a penny out and cannot be explained.
 *
 * Only this module converts between the two representations.
 */
const DECIMAL = /^(-)?(\d+)?(?:\.(\d{1,2}))?$/;

/** Display string -> integer hundredths. Null for anything we refuse. */
export function parseAmountInput(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;

  const trimmed = String(raw).trim();
  if (trimmed === '') return null;

  const match = trimmed.match(DECIMAL);
  if (!match) return null;

  const [, sign, whole, fraction] = match;
  // Rejects a bare "-", "." or "-." which the pattern otherwise allows.
  if (whole === undefined && fraction === undefined) return null;

  // Digits are combined arithmetically rather than by multiplying a parsed
  // float, so 10.07 lands on exactly 1007.
  const minor = Number(whole ?? '0') * 100 + Number((fraction ?? '').padEnd(2, '0'));

  if (!Number.isFinite(minor) || minor === 0) return null;
  return sign === '-' ? -minor : minor;
}

/** Integer hundredths -> "10.50". Built from integers, so exact. */
export function formatMinor(minor) {
  if (!Number.isFinite(minor)) return '—';

  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(minor);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

/** As formatMinor, but gains carry an explicit plus. */
export function formatMinorSigned(minor) {
  if (!Number.isFinite(minor)) return '—';
  return minor > 0 ? `+${formatMinor(minor)}` : formatMinor(minor);
}

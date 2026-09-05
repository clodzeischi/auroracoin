/**
 * Pairing a child's device.
 *
 * A parent cannot name a child's device in advance: the device signs in
 * anonymously, so its uid does not exist until it first opens the app. The
 * answer is the same shape as an invite - a short-lived ticket, keyed by a
 * secret, that the device redeems for a durable record of what it may see.
 *
 * This module owns the format of that secret. Both backends and the UI share
 * it so the alphabet cannot drift between the screen a code is read from and
 * the keypad it is typed into.
 */

// Read aloud across a room and typed by a child, so the characters that get
// confused when spoken or squinted at are simply absent: I, L, O, 0 and 1.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const PAIRING_CODE_LENGTH = 6;

// Long enough to walk to the other room, short enough that a code overheard
// and not used is worthless by the time anyone acts on it. The rules enforce
// their own 24h ceiling independently; this is the value the app picks.
export const PAIRING_TTL_MINUTES = 10;

/** Reasons a redemption can fail that the UI words differently. */
export const PAIRING_UNKNOWN = 'unknown';
export const PAIRING_EXPIRED = 'expired';

export const pairingFailure = (reason) =>
  Object.assign(new Error(`Pairing failed: ${reason}`), { reason });

export const generatePairingCode = () => {
  // Rejection-free modulo is fine here: 2^32 over a 31-character alphabet
  // leaves a bias far below anything that matters for a ten-minute secret.
  const values = new Uint32Array(PAIRING_CODE_LENGTH);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join('');
};

/** What the child typed -> what the parent's screen showed. */
export const normalizePairingCode = (raw) =>
  String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const isWellFormedCode = (code) =>
  typeof code === 'string' &&
  code.length === PAIRING_CODE_LENGTH &&
  [...code].every((character) => ALPHABET.includes(character));

export const pairingExpiry = (from = Date.now()) =>
  new Date(from + PAIRING_TTL_MINUTES * 60 * 1000);

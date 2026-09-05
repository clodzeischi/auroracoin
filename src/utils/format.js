/**
 * Day-month-year ordering is fixed rather than locale-derived, so the note
 * always reads the same way; only the month name is localized.
 */
export function formatEditedNote({ editedBy, editedByName, editedAt } = {}) {
  if (!editedBy || !(editedAt instanceof Date)) return null;

  const month = editedAt.toLocaleDateString(undefined, { month: 'long' });
  const who = editedByName || editedBy;
  return `edited by ${who} on ${editedAt.getDate()} ${month} ${editedAt.getFullYear()}`;
}

/** A person's display name where we have one, their email where we do not. */
export const personLabel = (name, email) => name || email || '\u2014';

/**
 * Day-month-year ordering is fixed rather than locale-derived, so the note
 * always reads the same way; only the month name is localized.
 */
export function formatEditedNote({ editedBy, editedAt } = {}) {
  if (!editedBy || !(editedAt instanceof Date)) return null;

  const month = editedAt.toLocaleDateString(undefined, { month: 'long' });
  return `edited by ${editedBy} on ${editedAt.getDate()} ${month} ${editedAt.getFullYear()}`;
}

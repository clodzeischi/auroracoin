import { describe, it, expect } from 'vitest';
import { formatEditedNote } from './format.js';

describe('formatEditedNote', () => {
  it('reads as a sentence naming who changed it and when', () => {
    expect(
      formatEditedNote({
        editedBy: 'parent2@example.com',
        editedAt: new Date('2026-09-03T10:00:00Z'),
      })
    ).toBe('edited by parent2@example.com on 3 September 2026');
  });

  it('returns null for a transaction that has never been edited', () => {
    expect(formatEditedNote({})).toBeNull();
    expect(formatEditedNote({ editedBy: 'a@b.com' })).toBeNull();
    expect(formatEditedNote({ editedAt: new Date() })).toBeNull();
  });

  it('returns null while an edit timestamp is still pending on the server', () => {
    expect(formatEditedNote({ editedBy: 'a@b.com', editedAt: null })).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { formatEditedNote } from './format.js';

import { personLabel } from './format.js';

describe('personLabel', () => {
  it('prefers a display name to an email address', () => {
    expect(personLabel('Deeanna', 'deeanna@example.com')).toBe('Deeanna');
  });

  it('falls back to the email for entries written before names were stored', () => {
    expect(personLabel(null, 'deeanna@example.com')).toBe('deeanna@example.com');
  });

  it('shows a dash when it has neither', () => {
    expect(personLabel(null, null)).toBe('\u2014');
  });
});

describe('formatEditedNote', () => {
  it('reads as a sentence naming who changed it and when', () => {
    expect(
      formatEditedNote({
        editedBy: 'parent2@example.com',
        editedAt: new Date('2026-09-03T10:00:00Z'),
      })
    ).toBe('edited by parent2@example.com on 3 September 2026');
  });

  it('names the editor rather than their email when a name is known', () => {
    expect(
      formatEditedNote({
        editedBy: 'parent2@example.com',
        editedByName: 'Deeanna',
        editedAt: new Date('2026-09-03T10:00:00Z'),
      })
    ).toBe('edited by Deeanna on 3 September 2026');
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

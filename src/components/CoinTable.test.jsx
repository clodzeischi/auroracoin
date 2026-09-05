import { describe, it, expect } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoinTable } from './CoinTable.jsx';
import { createFakeBackend } from '../test/fakeBackend.js';

const tx = (over = {}) => ({
  id: 'tx-1',
  amountMinor: 1000,
  category: 'chores',
  comment: 'tidied her room',
  user: 'parent@example.com',
  timestamp: new Date('2026-09-01T00:00:00Z'),
  editedBy: null,
  editedAt: null,
  ...over,
});

const setup = (transactions = [tx()]) => {
  const backend = createFakeBackend();
  render(<CoinTable backend={backend} user={{ email: 'parent2@example.com' }} />);
  act(() => backend.emitTransactions(transactions));
  return { backend, user: userEvent.setup() };
};

describe('CoinTable', () => {
  it('turns each amount into a control, so a keyboard reaches every entry', () => {
    setup();
    expect(screen.getByRole('button', { name: /edit transaction.*\+10\.00/i })).toBeInTheDocument();
  });

  it('opens the editor prefilled when an entry is clicked', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /edit transaction/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toHaveValue(10);
    expect(screen.getByLabelText(/category/i)).toHaveValue('chores');
    expect(screen.getByLabelText(/comment/i)).toHaveValue('tidied her room');
  });

  it('saves an edit against the signed-in editor, not the original author', async () => {
    const { backend, user } = setup();

    await user.click(screen.getByRole('button', { name: /edit transaction/i }));
    await user.clear(screen.getByLabelText(/amount/i));
    await user.type(screen.getByLabelText(/amount/i), '15.75');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(backend.updateTransaction).toHaveBeenCalledWith('tx-1', {
      amountMinor: 1575,
      comment: 'tidied her room',
      category: 'chores',
      editedBy: 'parent2@example.com',
    });
    expect(backend.addTransaction).not.toHaveBeenCalled();
  });

  it('shows who edited an entry and when, once it has been edited', () => {
    setup([
      tx({
        editedBy: 'parent2@example.com',
        editedAt: new Date('2026-09-03T09:00:00Z'),
      }),
    ]);

    expect(
      screen.getByText('edited by parent2@example.com on 3 September 2026')
    ).toBeInTheDocument();
  });

  it('shows no edit note on an entry that was never edited', () => {
    setup();
    expect(screen.queryByText(/edited by/i)).not.toBeInTheDocument();
  });

  it('asks before deleting, because a mis-tap on a phone is easy', async () => {
    const { backend, user } = setup();

    await user.click(screen.getByRole('button', { name: /delete transaction/i }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(backend.deleteTransaction).not.toHaveBeenCalled();
  });

  it('deletes once confirmed', async () => {
    const { backend, user } = setup();

    await user.click(screen.getByRole('button', { name: /delete transaction/i }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    expect(backend.deleteTransaction).toHaveBeenCalledWith('tx-1');
  });

  it('keeps the entry when the confirmation is dismissed', async () => {
    const { backend, user } = setup();

    await user.click(screen.getByRole('button', { name: /delete transaction/i }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /cancel/i }));

    expect(backend.deleteTransaction).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not open the editor when the delete control is used', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /delete transaction/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the entry in the confirmation, so it is clear what is going', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /delete transaction/i }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Chores');
  });
});

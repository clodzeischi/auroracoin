import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FamilyDashboard } from './FamilyDashboard.jsx';
import { createFakeBackend } from '../test/fakeBackend.js';

const NOW = new Date('2026-09-15T12:00:00Z');
const FAMILY = { id: 'fam1', name: 'The Aurora House' };
const CHILDREN = [
  { id: 'c1', name: 'Sparrow' },
  { id: 'c2', name: 'Wren' },
];

const tx = (amountMinor, category, iso) => ({
  id: `${amountMinor}-${iso}`,
  amountMinor,
  category,
  comment: '',
  user: 'parent@example.com',
  timestamp: new Date(iso),
});

const setup = (children = CHILDREN, overrides = {}) => {
  const ledgers = new Map(children.map((c) => [c.id, createFakeBackend()]));
  const handlers = {
    onOpenChild: vi.fn(),
    onAddChild: vi.fn(),
    onRenameChild: vi.fn(() => Promise.resolve()),
    onDeleteChild: vi.fn(() => Promise.resolve()),
    onInvite: vi.fn(() => Promise.resolve()),
    onCancelInvite: vi.fn(() => Promise.resolve()),
    onCreatePairingCode: vi.fn(() => Promise.resolve('ABC234')),
    onCancelPairingCode: vi.fn(() => Promise.resolve()),
    onUnpairDevice: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  render(
    <FamilyDashboard
      family={FAMILY}
      children={children}
      ledgerFor={(id) => ledgers.get(id)}
      now={NOW}
      pendingInvites={overrides.pendingInvites ?? []}
      {...handlers}
    />
  );
  return { ledgers, ...handlers, user: userEvent.setup() };
};

const cardFor = (name) => screen.getByRole('region', { name: new RegExp(`${name}'s account`, 'i') });
const openButton = (name) => screen.getByRole('button', { name: new RegExp(`open ${name}`, 'i') });

describe('FamilyDashboard', () => {
  it('names the family and how many accounts it holds', () => {
    setup();
    expect(screen.getByText('The Aurora House')).toBeInTheDocument();
    expect(screen.getByText('2 accounts')).toBeInTheDocument();
  });

  it('says "1 account" rather than "1 accounts"', () => {
    setup([CHILDREN[0]]);
    expect(screen.getByText('1 account')).toBeInTheDocument();
  });

  it('gives each child their own card', () => {
    setup();
    expect(cardFor('Sparrow')).toBeInTheDocument();
    expect(cardFor('Wren')).toBeInTheDocument();
  });

  it('shows a balance spanning all time, not just this month', () => {
    const { ledgers } = setup();

    act(() =>
      ledgers.get('c1').emitTransactions([
        tx(5000, 'gift', '2025-03-01T00:00:00Z'),
        tx(-1000, 'toys', '2026-09-10T00:00:00Z'),
      ])
    );

    expect(within(cardFor('Sparrow')).getByText('40.00')).toBeInTheDocument();
  });

  it('summarises the month in a sentence, naming the biggest spend', () => {
    const { ledgers } = setup();

    act(() =>
      ledgers.get('c1').emitTransactions([
        tx(4000, 'chores', '2026-09-02T00:00:00Z'),
        tx(-1500, 'toys', '2026-09-09T00:00:00Z'),
        tx(-200, 'treats', '2026-09-09T00:00:00Z'),
      ])
    );

    const card = cardFor('Sparrow');
    expect(card).toHaveTextContent('Deposited 40.00 this month');
    expect(card).toHaveTextContent('spent 17.00');
    expect(card).toHaveTextContent('mostly on toys');
  });

  it('says so plainly when nothing moved this month', () => {
    const { ledgers } = setup();

    act(() => ledgers.get('c1').emitTransactions([tx(5000, 'gift', '2025-03-01T00:00:00Z')]));

    expect(within(cardFor('Sparrow')).getByText(/nothing moved this month/i)).toBeInTheDocument();
  });

  it('keeps each child\'s figures to their own card', () => {
    const { ledgers } = setup();

    act(() =>
      ledgers.get('c1').emitTransactions([
        tx(6000, 'gift', '2025-01-02T00:00:00Z'),
        tx(4000, 'chores', '2026-09-02T00:00:00Z'),
      ])
    );
    act(() =>
      ledgers.get('c2').emitTransactions([
        tx(1100, 'gift', '2025-01-02T00:00:00Z'),
        tx(900, 'chores', '2026-09-02T00:00:00Z'),
      ])
    );

    expect(within(cardFor('Sparrow')).getByText('100.00')).toBeInTheDocument();
    expect(within(cardFor('Wren')).getByText('20.00')).toBeInTheDocument();
  });

  it('opens a child\'s account from their name', async () => {
    const { onOpenChild, user } = setup();

    await user.click(openButton('Wren'));

    expect(onOpenChild).toHaveBeenCalledWith('c2');
  });

  it('surfaces a failure on one card without breaking the others', () => {
    const { ledgers } = setup();

    act(() => ledgers.get('c1').emitTransactionsError(new Error('permission-denied')));
    act(() =>
      ledgers.get('c2').emitTransactions([
        tx(1100, 'gift', '2025-01-02T00:00:00Z'),
        tx(900, 'chores', '2026-09-02T00:00:00Z'),
      ])
    );

    expect(within(cardFor('Sparrow')).getByText(/couldn't load/i)).toBeInTheDocument();
    expect(within(cardFor('Wren')).getByText('20.00')).toBeInTheDocument();
  });

  describe('managing children', () => {
    it('renames a child through a prefilled prompt', async () => {
      const { onRenameChild, user } = setup();

      await user.click(screen.getByRole('button', { name: /rename sparrow/i }));
      const field = screen.getByLabelText(/nickname/i);
      expect(field).toHaveValue('Sparrow');

      await user.clear(field);
      await user.type(field, 'Sparrowhawk');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onRenameChild).toHaveBeenCalledWith('c1', 'Sparrowhawk');
    });

    it('will not rename to nothing', async () => {
      const { onRenameChild, user } = setup();

      await user.click(screen.getByRole('button', { name: /rename sparrow/i }));
      await user.clear(screen.getByLabelText(/nickname/i));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onRenameChild).not.toHaveBeenCalled();
    });

    it('asks before deleting, and says the history goes too', async () => {
      const { onDeleteChild, user } = setup();

      await user.click(screen.getByRole('button', { name: /delete sparrow's account/i }));

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent(/permanently removed/i);
      expect(onDeleteChild).not.toHaveBeenCalled();
    });

    it('deletes once confirmed', async () => {
      const { onDeleteChild, user } = setup();

      await user.click(screen.getByRole('button', { name: /delete sparrow's account/i }));
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /delete account/i }));

      expect(onDeleteChild).toHaveBeenCalledWith('c1');
    });

    it('keeps the child when the confirmation is dismissed', async () => {
      const { onDeleteChild, user } = setup();

      await user.click(screen.getByRole('button', { name: /delete sparrow's account/i }));
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /cancel/i }));

      expect(onDeleteChild).not.toHaveBeenCalled();
    });

    it('does not open the account when a management control is used', async () => {
      const { onOpenChild, user } = setup();

      await user.click(screen.getByRole('button', { name: /rename sparrow/i }));

      expect(onOpenChild).not.toHaveBeenCalled();
    });
  });

  describe('inviting a parent', () => {
    it('invites by Google account email', async () => {
      const { onInvite, user } = setup();

      await user.type(screen.getByLabelText(/google account email/i), 'Deeanna@Example.com');
      await user.click(screen.getByRole('button', { name: /send invite/i }));

      expect(onInvite).toHaveBeenCalledWith('deeanna@example.com');
    });

    it('rejects something that is not an email address', async () => {
      const { onInvite, user } = setup();

      await user.type(screen.getByLabelText(/google account email/i), 'deeanna');
      await user.click(screen.getByRole('button', { name: /send invite/i }));

      expect(onInvite).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('lists an outstanding invite and can cancel it', async () => {
      const { onCancelInvite, user } = setup(CHILDREN, {
        pendingInvites: [{ email: 'deeanna@example.com' }],
      });

      expect(screen.getByRole('list', { name: /pending invites/i })).toHaveTextContent('deeanna@example.com');

      await user.click(screen.getByRole('button', { name: /cancel invite to/i }));

      expect(onCancelInvite).toHaveBeenCalledWith('deeanna@example.com');
    });
  });
});

const device = (id, childId) => ({ id, childId, familyId: FAMILY.id, pairedAt: NOW });

describe('pairing a child device', () => {
  it('offers pairing on a child that has no device yet', () => {
    setup();
    expect(screen.getByRole('button', { name: /pair a device for sparrow/i })).toBeInTheDocument();
  });

  it('shows how many devices a child already has', () => {
    setup(CHILDREN, { devices: [device('d1', 'c1'), device('d2', 'c1')] });

    const card = screen.getByLabelText("Sparrow's account");
    expect(within(card).getByRole('button', { name: /manage devices for sparrow/i }))
      .toHaveTextContent('Devices (2)');
  });

  it('counts only the devices belonging to that child', () => {
    setup(CHILDREN, { devices: [device('d1', 'c1')] });

    const wren = screen.getByLabelText("Wren's account");
    expect(within(wren).getByRole('button', { name: /pair a device for wren/i })).toBeInTheDocument();
  });

  /**
   * The code is made on open rather than behind a further click: a parent who
   * reached this dialog has already said what they want, and a code that only
   * lives ten minutes should not start its clock before they can read it.
   */
  it('makes a code as soon as the dialog opens', async () => {
    const { onCreatePairingCode, user } = setup();
    await user.click(screen.getByRole('button', { name: /pair a device for sparrow/i }));

    expect(onCreatePairingCode).toHaveBeenCalledWith('c1');
    expect(await screen.findByText('ABC234')).toBeInTheDocument();
  });

  it('reads the code out in single characters for a screen reader', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /pair a device for sparrow/i }));

    expect(await screen.findByLabelText('Pairing code A B C 2 3 4')).toBeInTheDocument();
  });

  it('says which child the code is for', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /pair a device for sparrow/i }));

    expect(await screen.findByRole('heading', { name: /pair a device for sparrow/i }))
      .toBeInTheDocument();
  });

  it('surfaces a failure instead of showing an empty code', async () => {
    const { user } = setup(CHILDREN, {
      onCreatePairingCode: vi.fn(() => Promise.reject(new Error('offline'))),
    });
    await user.click(screen.getByRole('button', { name: /pair a device for sparrow/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not make a code/i);
  });

  it('lets a parent revoke a device from the same place they add one', async () => {
    const { onUnpairDevice, user } = setup(CHILDREN, { devices: [device('d1', 'c1')] });
    await user.click(screen.getByRole('button', { name: /manage devices for sparrow/i }));
    await user.click(await screen.findByRole('button', { name: /unpair this device from sparrow/i }));

    expect(onUnpairDevice).toHaveBeenCalledWith('d1');
  });

  const liveCode = (code, childId = 'c1') => ({
    id: code, code, childId, expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  /**
   * The same control opens this dialog to pair a device and to revoke one, so
   * minting on every open would leave a live code behind each time a parent
   * came here to take access away.
   */
  it('reuses a code the child already has rather than minting another', async () => {
    const { onCreatePairingCode, user } = setup(CHILDREN, { pairings: [liveCode('OLD123')] });
    await user.click(screen.getByRole('button', { name: /pair a device for sparrow/i }));

    expect(await screen.findByText('OLD123')).toBeInTheDocument();
    expect(onCreatePairingCode).not.toHaveBeenCalled();
  });

  it('mints a fresh one when the only code has expired', async () => {
    const { onCreatePairingCode, user } = setup(CHILDREN, {
      pairings: [{ id: 'DEAD01', code: 'DEAD01', childId: 'c1', expiresAt: new Date(Date.now() - 1000) }],
    });
    await user.click(screen.getByRole('button', { name: /pair a device for sparrow/i }));

    expect(await screen.findByText('ABC234')).toBeInTheDocument();
    expect(onCreatePairingCode).toHaveBeenCalledWith('c1');
  });

  it('ignores a code belonging to a different child', async () => {
    const { onCreatePairingCode, user } = setup(CHILDREN, { pairings: [liveCode('OTHER1', 'c2')] });
    await user.click(screen.getByRole('button', { name: /pair a device for sparrow/i }));

    await screen.findByText('ABC234');
    expect(onCreatePairingCode).toHaveBeenCalledWith('c1');
  });

  it('lets a parent cancel a spare code they read out and thought better of', async () => {
    const { onCancelPairingCode, user } = setup(CHILDREN, {
      pairings: [liveCode('SHOWN1'), liveCode('SPARE1')],
    });
    await user.click(screen.getByRole('button', { name: /pair a device for sparrow/i }));
    await user.click(await screen.findByRole('button', { name: /cancel code SPARE1/i }));

    expect(onCancelPairingCode).toHaveBeenCalledWith('SPARE1');
  });

  it('closes without pairing anything', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /pair a device for sparrow/i }));
    await screen.findByText('ABC234');
    await user.click(screen.getByRole('button', { name: /^done$/i }));

    expect(screen.queryByText('ABC234')).not.toBeInTheDocument();
  });

  it('does not open a child account when the pair control is used', async () => {
    const { onOpenChild, user } = setup();
    await user.click(screen.getByRole('button', { name: /pair a device for sparrow/i }));

    expect(onOpenChild).not.toHaveBeenCalled();
  });
});

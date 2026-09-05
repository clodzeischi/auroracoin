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

const setup = (children = CHILDREN) => {
  const ledgers = new Map(children.map((c) => [c.id, createFakeBackend()]));
  const onOpenChild = vi.fn();
  render(
    <FamilyDashboard
      family={FAMILY}
      children={children}
      ledgerFor={(id) => ledgers.get(id)}
      now={NOW}
      onOpenChild={onOpenChild}
      onAddChild={vi.fn()}
    />
  );
  return { ledgers, onOpenChild, user: userEvent.setup() };
};

const cardFor = (name) => screen.getByRole('button', { name: new RegExp(`open ${name}`, 'i') });

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

  it('opens a child\'s account when their card is used', async () => {
    const { onOpenChild, user } = setup();

    await user.click(cardFor('Wren'));

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
});

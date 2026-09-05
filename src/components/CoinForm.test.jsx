import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoinForm } from './CoinForm.jsx';
import { createFakeBackend } from '../test/fakeBackend.js';

const setup = (props = {}) => {
  const backend = createFakeBackend();
  const toggle = vi.fn();
  render(
    <CoinForm
      isOpen
      toggle={toggle}
      user={{ email: 'parent@example.com', displayName: 'Constantin' }}
      backend={backend}
      {...props}
    />
  );
  return { backend, toggle, user: userEvent.setup() };
};

const amountField = () => screen.getByLabelText(/amount/i);
const categoryField = () => screen.getByLabelText(/category/i);
const submit = () => screen.getByRole('button', { name: /submit/i });
const optionLabels = () =>
  [...categoryField().querySelectorAll('option')]
    .map((o) => o.textContent)
    .filter((t) => t && !/choose/i.test(t));

describe('CoinForm', () => {
  it('refuses an empty amount', async () => {
    const { backend, user } = setup();

    await user.click(submit());

    expect(backend.addTransaction).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/two decimal places/i);
  });

  it('accepts two decimal places and stores them as hundredths', async () => {
    const { backend, user } = setup();

    await user.type(amountField(), '10.07');
    await user.selectOptions(categoryField(), 'chores');
    await user.click(submit());

    expect(backend.addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 1007 })
    );
  });

  it('refuses a third decimal place rather than rounding it away', async () => {
    // Silently turning 5.755 into 5.76 would write a different number than
    // the one typed.
    const { backend, user } = setup();

    await user.type(amountField(), '5.755');
    await user.click(submit());

    expect(backend.addTransaction).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/two decimal places/i);
  });

  it('refuses zero, which would be a no-op entry', async () => {
    const { backend, user } = setup();

    await user.type(amountField(), '0');
    await user.click(submit());

    expect(backend.addTransaction).not.toHaveBeenCalled();
  });

  it('offers earning categories when coins are being added', async () => {
    const { user } = setup();

    await user.type(amountField(), '10');

    expect(optionLabels()).toContain('Chores');
    expect(optionLabels()).not.toContain('Toys');
  });

  it('offers spending categories when coins are being taken away', async () => {
    const { user } = setup();

    await user.type(amountField(), '-10');

    expect(optionLabels()).toContain('Toys');
    expect(optionLabels()).not.toContain('Chores');
  });

  it('clears a chosen category when the amount flips direction', async () => {
    // Otherwise "Chores" could be submitted against a spend.
    const { user } = setup();

    await user.type(amountField(), '10');
    await user.selectOptions(categoryField(), 'chores');
    expect(categoryField()).toHaveValue('chores');

    await user.clear(amountField());
    await user.type(amountField(), '-10');

    expect(categoryField()).toHaveValue('');
  });

  it('keeps the category while the amount is being retyped', async () => {
    // Clearing the field makes the amount momentarily invalid; the category
    // must survive that, or editing an amount silently drops it.
    const { user } = setup();

    await user.type(amountField(), '10');
    await user.selectOptions(categoryField(), 'chores');
    await user.clear(amountField());
    await user.type(amountField(), '15');

    expect(categoryField()).toHaveValue('chores');
  });

  it('requires a category before it will write', async () => {
    const { backend, user } = setup();

    await user.type(amountField(), '10');
    await user.click(submit());

    expect(backend.addTransaction).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/category/i);
  });

  it('accepts a negative amount, so coins can be spent', async () => {
    const { backend, user } = setup();

    await user.type(amountField(), '-4.25');
    await user.selectOptions(categoryField(), 'toys');
    await user.click(submit());

    expect(backend.addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: -425, category: 'toys' })
    );
  });

  it('writes the amount in hundredths, attributed to the signed-in user', async () => {
    const { backend, user } = setup();

    await user.type(amountField(), '12.50');
    await user.selectOptions(categoryField(), 'gift');
    await user.type(screen.getByLabelText(/comment/i), 'birthday');
    await user.click(submit());

    expect(backend.addTransaction).toHaveBeenCalledWith({
      amountMinor: 1250,
      comment: 'birthday',
      category: 'gift',
      user: 'parent@example.com',
      userName: 'Constantin',
    });
  });

  it('closes after a successful submit', async () => {
    const { toggle, user } = setup();

    await user.type(amountField(), '3');
    await user.selectOptions(categoryField(), 'chores');
    await user.click(submit());

    expect(toggle).toHaveBeenCalled();
  });

  it('stays open and reports the problem when the write fails', async () => {
    const backend = createFakeBackend();
    backend.addTransaction.mockRejectedValue(new Error('permission-denied'));
    const toggle = vi.fn();
    render(
      <CoinForm isOpen toggle={toggle} user={{ email: 'p@example.com' }} backend={backend} />
    );
    const user = userEvent.setup();

    await user.type(amountField(), '3');
    await user.selectOptions(categoryField(), 'chores');
    await user.click(submit());

    expect(toggle).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/could not/i);
  });

  it('renders nothing while closed', () => {
    const backend = createFakeBackend();
    render(
      <CoinForm isOpen={false} toggle={() => {}} user={{ email: 'p@example.com' }} backend={backend} />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    // Previously the component library's job; now ours.
    const { toggle, user } = setup();

    await user.keyboard('{Escape}');

    expect(toggle).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', async () => {
    const { toggle, user } = setup();

    await user.click(screen.getByRole('dialog').parentElement);

    expect(toggle).toHaveBeenCalled();
  });

  it('stays open when the dialog itself is clicked', async () => {
    const { toggle, user } = setup();

    await user.click(screen.getByRole('dialog'));

    expect(toggle).not.toHaveBeenCalled();
  });

  it('focuses the amount field on open, so typing just works', () => {
    setup();

    expect(amountField()).toHaveFocus();
  });

  it('refuses to write when nobody is signed in', async () => {
    const { backend, user } = setup({ user: null });

    await user.type(amountField(), '5');
    await user.selectOptions(categoryField(), 'chores');
    await user.click(submit());

    expect(backend.addTransaction).not.toHaveBeenCalled();
  });
});

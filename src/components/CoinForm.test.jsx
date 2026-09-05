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
      user={{ email: 'parent@example.com' }}
      backend={backend}
      {...props}
    />
  );
  return { backend, toggle, user: userEvent.setup() };
};

const submit = () => screen.getByRole('button', { name: /submit/i });

describe('CoinForm', () => {
  it('refuses an empty amount', async () => {
    const { backend, user } = setup();

    await user.click(submit());

    expect(backend.addTransaction).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/whole number/i);
  });

  it('refuses a fractional amount rather than silently truncating it', async () => {
    // parseInt('5.7') === 5, which would have written a different number than
    // the one typed - and the Firestore rule requires an integer anyway.
    const { backend, user } = setup();

    await user.type(screen.getByLabelText(/amount/i), '5.7');
    await user.click(submit());

    expect(backend.addTransaction).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/whole number/i);
  });

  it('refuses zero, which would be a no-op entry', async () => {
    const { backend, user } = setup();

    await user.type(screen.getByLabelText(/amount/i), '0');
    await user.click(submit());

    expect(backend.addTransaction).not.toHaveBeenCalled();
  });

  it('accepts a negative amount, so coins can be spent', async () => {
    const { backend, user } = setup();

    await user.type(screen.getByLabelText(/amount/i), '-4');
    await user.click(submit());

    expect(backend.addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: -4 })
    );
  });

  it('writes the amount as a number, attributed to the signed-in user', async () => {
    const { backend, user } = setup();

    await user.type(screen.getByLabelText(/amount/i), '12');
    await user.type(screen.getByLabelText(/comment/i), 'birthday');
    await user.click(submit());

    expect(backend.addTransaction).toHaveBeenCalledWith({
      amount: 12,
      comment: 'birthday',
      user: 'parent@example.com',
    });
  });

  it('closes after a successful submit', async () => {
    const { toggle, user } = setup();

    await user.type(screen.getByLabelText(/amount/i), '3');
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

    await user.type(screen.getByLabelText(/amount/i), '3');
    await user.click(submit());

    expect(toggle).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/could not/i);
  });

  it('refuses to write when nobody is signed in', async () => {
    const { backend, user } = setup({ user: null });

    await user.type(screen.getByLabelText(/amount/i), '5');
    await user.click(submit());

    expect(backend.addTransaction).not.toHaveBeenCalled();
  });
});

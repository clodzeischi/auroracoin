import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PairDevice } from './PairDevice.jsx';
import { PAIRING_EXPIRED, PAIRING_UNKNOWN, pairingFailure } from '../data/pairing.js';

const setup = (overrides = {}) => {
  const handlers = {
    onPair: vi.fn(() => Promise.resolve()),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<PairDevice {...handlers} />);
  return { ...handlers, user: userEvent.setup() };
};

const codeField = () => screen.getByLabelText(/pairing code/i);

describe('PairDevice', () => {
  it('tells the child where the code comes from', () => {
    setup();
    expect(screen.getByText(/ask a parent/i)).toBeInTheDocument();
  });

  it('refuses a half-typed code without troubling the backend', async () => {
    const { onPair, user } = setup();
    await user.type(codeField(), 'ABC');
    await user.click(screen.getByRole('button', { name: /pair device/i }));

    expect(onPair).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/6-character code/i);
  });

  it('accepts a code typed the way it was read out, in lower case with a dash', async () => {
    const { onPair, user } = setup();
    await user.type(codeField(), 'abc-234');
    await user.click(screen.getByRole('button', { name: /pair device/i }));

    expect(onPair).toHaveBeenCalledWith('ABC234');
  });

  it('says a wrong code is wrong, in words a child can act on', async () => {
    const { user } = setup({ onPair: vi.fn(() => Promise.reject(pairingFailure(PAIRING_UNKNOWN))) });
    await user.type(codeField(), 'ABC234');
    await user.click(screen.getByRole('button', { name: /pair device/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/doesn't work.*ask for a new one/i);
  });

  it('distinguishes an expired code from a wrong one', async () => {
    const { user } = setup({ onPair: vi.fn(() => Promise.reject(pairingFailure(PAIRING_EXPIRED))) });
    await user.type(codeField(), 'ABC234');
    await user.click(screen.getByRole('button', { name: /pair device/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
  });

  it('falls back to a plain message for a failure it does not recognise', async () => {
    const { user } = setup({ onPair: vi.fn(() => Promise.reject(new Error('offline'))) });
    await user.type(codeField(), 'ABC234');
    await user.click(screen.getByRole('button', { name: /pair device/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not pair this device/i);
  });

  it('lets the child try again after a failure', async () => {
    const { user } = setup({ onPair: vi.fn(() => Promise.reject(pairingFailure(PAIRING_UNKNOWN))) });
    await user.type(codeField(), 'ABC234');
    await user.click(screen.getByRole('button', { name: /pair device/i }));
    await screen.findByRole('alert');

    expect(screen.getByRole('button', { name: /pair device/i })).toBeEnabled();
  });

  it('offers a way out of a session that was started by mistake', async () => {
    const { onCancel, user } = setup();
    await user.click(screen.getByRole('button', { name: /not now/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});

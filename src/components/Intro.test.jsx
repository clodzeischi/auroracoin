import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intro } from './Intro.jsx';
import {
  CHILD_SESSIONS_DISABLED, SESSION_CANCELLED, SESSION_UNAVAILABLE, sessionFailure,
} from '../data/session.js';

const setup = (overrides = {}) => {
  const handlers = {
    onSignIn: vi.fn(() => Promise.resolve()),
    onPairDevice: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  render(<Intro {...handlers} />);
  return { ...handlers, user: userEvent.setup() };
};

const pairLink = () => screen.getByRole('button', { name: /pair it with a code|starting/i });
const signIn = () => screen.getByRole('button', { name: /sign in with google|signing in/i });

describe('starting a child device', () => {
  it('begins a session when the pairing link is used', async () => {
    const { onPairDevice, user } = setup();
    await user.click(pairLink());

    expect(onPairDevice).toHaveBeenCalled();
  });

  /**
   * The whole reason this component holds state: the promise used to be
   * dropped, so a refused sign-in was indistinguishable from a dead button.
   */
  it('says so when child devices are switched off for the project', async () => {
    const { user } = setup({
      onPairDevice: vi.fn(() => Promise.reject(sessionFailure(CHILD_SESSIONS_DISABLED))),
    });
    await user.click(pairLink());

    expect(await screen.findByRole('alert')).toHaveTextContent(/anonymous sign-in/i);
  });

  it('falls back to a plain message for any other failure', async () => {
    const { user } = setup({
      onPairDevice: vi.fn(() => Promise.reject(sessionFailure(SESSION_UNAVAILABLE))),
    });
    await user.click(pairLink());

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not start/i);
  });

  it('lets the device try again after a failure', async () => {
    const { user } = setup({
      onPairDevice: vi.fn(() => Promise.reject(sessionFailure(SESSION_UNAVAILABLE))),
    });
    await user.click(pairLink());
    await screen.findByRole('alert');

    expect(pairLink()).toBeEnabled();
  });

  it('shows it is working, and blocks a second start meanwhile', async () => {
    let release;
    const { user } = setup({
      onPairDevice: vi.fn(() => new Promise((resolve) => { release = resolve; })),
    });
    await user.click(pairLink());

    expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled();
    expect(signIn()).toBeDisabled();
    release();
  });
});

describe('signing in as a parent', () => {
  it('reports a refused sign-in rather than looking inert', async () => {
    const { user } = setup({
      onSignIn: vi.fn(() => Promise.reject(sessionFailure(SESSION_UNAVAILABLE))),
    });
    await user.click(signIn());

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not start/i);
  });

  /** Closing the Google popup is a decision, not something to apologise for. */
  it('stays quiet when the popup is simply closed', async () => {
    const { user } = setup({
      onSignIn: vi.fn(() => Promise.reject(sessionFailure(SESSION_CANCELLED))),
    });
    await user.click(signIn());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(signIn()).toBeEnabled();
  });
});

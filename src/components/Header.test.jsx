import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header.jsx';
import { SESSION_CANCELLED, SESSION_UNAVAILABLE, sessionFailure } from '../data/session.js';

const renderHeader = (props = {}) =>
  render(<Header loading={false} login={vi.fn()} logout={vi.fn()} user={null} {...props} />);

describe('Header', () => {
  it('offers sign-in to a signed-out visitor', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders no auth controls while the session is still resolving', () => {
    renderHeader({ loading: true });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('gives a parent sign-out', () => {
    // Adding a transaction lives on a child's page: it cannot exist without
    // knowing whose ledger it belongs to.
    renderHeader({ user: { email: 'parent@example.com' } });
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('gives a child no sign-in control', () => {
    // Signing in would replace this device's anonymous session outright.
    renderHeader({ user: { isAnonymous: true } });
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('shows the brand mark, everywhere, at one size', () => {
    // logo.png carries its own "AuroraCoin" wordmark, so the image's alt
    // text is what names the link - there is no separate title element.
    renderHeader({ user: { isAnonymous: true } });
    const brand = screen.getByRole('link', { name: 'AuroraCoin' });
    expect(brand.querySelector('img')).toHaveAttribute('src', '/logo.png');
  });

  it('asks a child to confirm before signing out, since it cannot be undone', async () => {
    // Anonymous auth has no way back: the next signInAnonymously() on this
    // device gets a brand new uid, so this is the one persona that could
    // otherwise get permanently stranded with no way to reach Google sign-in.
    const logout = vi.fn();
    const user = userEvent.setup();
    renderHeader({ user: { isAnonymous: true }, logout });

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(logout).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Sign out' }));

    expect(logout).toHaveBeenCalled();
  });

  it('lets a child cancel out of signing out', async () => {
    const logout = vi.fn();
    const user = userEvent.setup();
    renderHeader({ user: { isAnonymous: true }, logout });

    await user.click(screen.getByRole('button', { name: /sign out/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(logout).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  describe('signing in', () => {
    /**
     * The whole reason this button holds its own state: the promise used to
     * be dropped, so a refused sign-in looked exactly like a dead button.
     */
    it('shows it is working while a sign-in is in flight', async () => {
      let release;
      const login = vi.fn(() => new Promise((resolve) => { release = resolve; }));
      const user = userEvent.setup();
      renderHeader({ login });

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
      release();
    });

    it('reports a refused sign-in rather than looking inert', async () => {
      const login = vi.fn(() => Promise.reject(sessionFailure(SESSION_UNAVAILABLE)));
      const user = userEvent.setup();
      renderHeader({ login });

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/could not start/i);
    });

    /** Closing the Google popup is a decision, not something to apologise for. */
    it('stays quiet when the popup is simply closed', async () => {
      const login = vi.fn(() => Promise.reject(sessionFailure(SESSION_CANCELLED)));
      const user = userEvent.setup();
      renderHeader({ login });

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    });

    /**
     * Header doesn't unmount across a sign-in: a successful login swaps `user`
     * in on the same component instance, so nothing on that path ever clears
     * `signingIn`. A later sign-out has to clear it instead, or the button
     * that reappears is stuck reading "Signing in..." forever.
     */
    it('resets after a sign-in is followed by a sign-out', async () => {
      let release;
      const login = vi.fn(() => new Promise((resolve) => { release = resolve; }));
      const user = userEvent.setup();
      const { rerender } = renderHeader({ login });

      await user.click(screen.getByRole('button', { name: /sign in/i }));
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
      release();

      rerender(<Header loading={false} login={login} logout={vi.fn()} user={{ email: 'parent@example.com' }} />);
      rerender(<Header loading={false} login={login} logout={vi.fn()} user={null} />);

      const signIn = screen.getByRole('button', { name: /^sign in with google$/i });
      expect(signIn).toBeEnabled();
    });
  });
});

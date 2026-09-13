import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header.jsx';

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

  it('still shows the child whose app this is', () => {
    renderHeader({ user: { isAnonymous: true } });
    expect(screen.getByText('AuroraCoin')).toBeInTheDocument();
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
});

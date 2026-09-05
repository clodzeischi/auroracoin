import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('gives a parent the add and sign-out controls', () => {
    renderHeader({ user: { email: 'parent@example.com' } });
    expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('gives a child no controls at all', () => {
    // Deliberate: her session is anonymous, so signing out would destroy the
    // pairing permanently and signing in would replace it. Neither is offered.
    renderHeader({ user: { isAnonymous: true } });

    expect(screen.queryByRole('button', { name: /add transaction/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('still shows the child whose app this is', () => {
    renderHeader({ user: { isAnonymous: true } });
    expect(screen.getByText('AuroraCoin')).toBeInTheDocument();
  });
});

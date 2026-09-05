import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.jsx';
import { getBackend } from './data/index.js';

/**
 * Screen transitions, driven through the real mock backend - the same one
 * `yarn dev` runs against, because in a test build the data seam resolves to
 * it exactly as it does in dev.
 *
 * These exist because the add-children step used to be held open by
 * `children.length === 0`, so the first child arriving closed it: a parent got
 * one child during first-run setup and was dropped on the dashboard before the
 * Done button had ever rendered.
 */
const backend = getBackend();

const onboarding = () => screen.queryByRole('heading', { name: /add your children/i });
const dashboard = () => screen.queryByRole('heading', { name: /the aurora house/i });

beforeEach(async () => {
  await act(async () => {
    await backend.resetForDev({ seed: false });
    await backend.logout();
  });
});

afterEach(async () => {
  await act(async () => backend.resetForDev({ seed: true }));
});

const signInAndCreateFamily = async (user) => {
  await act(async () => backend.loginAs('parent'));
  await user.type(await screen.findByLabelText(/family nickname/i), 'The Aurora House');
  await user.click(screen.getByRole('button', { name: /continue/i }));
  await screen.findByLabelText(/child's nickname/i);
};

const addChild = async (user, name) => {
  await user.type(screen.getByLabelText(/child's nickname/i), name);
  await user.click(screen.getByRole('button', { name: /add child/i }));
};

describe('first-run setup', () => {
  it('walks family, then children', async () => {
    const user = userEvent.setup();
    render(<App />);

    await act(async () => backend.loginAs('parent'));
    expect(await screen.findByRole('heading', { name: /name your family/i })).toBeInTheDocument();

    await signInAndCreateFamily(user);
    expect(onboarding()).toBeInTheDocument();
  });

  it('offers no way out before there is a child', async () => {
    const user = userEvent.setup();
    render(<App />);
    await signInAndCreateFamily(user);

    expect(screen.queryByRole('button', { name: /^done$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument();
  });

  it('stays on the step after the first child, rather than ejecting', async () => {
    const user = userEvent.setup();
    render(<App />);
    await signInAndCreateFamily(user);

    await addChild(user, 'Sparrow');

    expect(await screen.findByRole('button', { name: /^done$/i })).toBeInTheDocument();
    expect(onboarding()).toBeInTheDocument();
    expect(dashboard()).not.toBeInTheDocument();
  });

  it('lets a parent add every child in one pass', async () => {
    const user = userEvent.setup();
    render(<App />);
    await signInAndCreateFamily(user);

    await addChild(user, 'Sparrow');
    await addChild(user, 'Wren');

    const listed = screen.getByLabelText(/children added/i);
    expect(listed).toHaveTextContent('Sparrow');
    expect(listed).toHaveTextContent('Wren');
    expect(onboarding()).toBeInTheDocument();
  });

  it('reaches the family view once the parent says they are done', async () => {
    const user = userEvent.setup();
    render(<App />);
    await signInAndCreateFamily(user);
    await addChild(user, 'Sparrow');

    await user.click(await screen.findByRole('button', { name: /^done$/i }));

    await waitFor(() => expect(dashboard()).toBeInTheDocument());
    expect(onboarding()).not.toBeInTheDocument();
  });
});

describe('adding a child later', () => {
  const reachDashboard = async (user) => {
    render(<App />);
    await signInAndCreateFamily(user);
    await addChild(user, 'Sparrow');
    await user.click(await screen.findByRole('button', { name: /^done$/i }));
    await waitFor(() => expect(dashboard()).toBeInTheDocument());
  };

  it('offers Back rather than Done before anything is added', async () => {
    const user = userEvent.setup();
    await reachDashboard(user);

    await user.click(screen.getByRole('button', { name: /add a child/i }));

    expect(await screen.findByRole('button', { name: /^back$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^done$/i })).not.toBeInTheDocument();
  });

  it('returns to the family view without adding anybody', async () => {
    const user = userEvent.setup();
    await reachDashboard(user);

    await user.click(screen.getByRole('button', { name: /add a child/i }));
    await user.click(await screen.findByRole('button', { name: /^back$/i }));

    await waitFor(() => expect(dashboard()).toBeInTheDocument());
    expect(screen.getByText('1 account')).toBeInTheDocument();
  });

  it('returns to the family view with the new child on it', async () => {
    const user = userEvent.setup();
    await reachDashboard(user);

    await user.click(screen.getByRole('button', { name: /add a child/i }));
    await addChild(user, 'Wren');
    await user.click(await screen.findByRole('button', { name: /^done$/i }));

    await waitFor(() => expect(dashboard()).toBeInTheDocument());
    expect(screen.getByText('2 accounts')).toBeInTheDocument();
  });
});

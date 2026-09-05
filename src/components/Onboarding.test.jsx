import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Onboarding } from './Onboarding.jsx';

const setup = (props = {}) => {
  const onCreateFamily = vi.fn(() => Promise.resolve('fam1'));
  const onAddChild = vi.fn(() => Promise.resolve('child1'));
  const onLeave = vi.fn();
  render(
    <Onboarding
      family={null}
      onCreateFamily={onCreateFamily}
      onAddChild={onAddChild}
      onLeave={onLeave}
      {...props}
    />
  );
  return { onCreateFamily, onAddChild, onLeave, user: userEvent.setup() };
};

const FAMILY = { id: 'fam1', name: 'The Aurora House' };

describe('Onboarding', () => {
  it('asks for a family nickname first', () => {
    setup();
    expect(screen.getByLabelText(/family nickname/i)).toBeInTheDocument();
  });

  it('warns that anything typed here is hosted by Google', () => {
    setup();
    expect(screen.getByText(/google's data policies/i)).toBeInTheDocument();
  });

  it('will not create a family without a name', async () => {
    const { onCreateFamily, user } = setup();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onCreateFamily).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('ignores a name that is only whitespace', async () => {
    const { onCreateFamily, user } = setup();

    await user.type(screen.getByLabelText(/family nickname/i), '   ');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onCreateFamily).not.toHaveBeenCalled();
  });

  it('creates the family with a trimmed name', async () => {
    const { onCreateFamily, user } = setup();

    await user.type(screen.getByLabelText(/family nickname/i), '  The Aurora House  ');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onCreateFamily).toHaveBeenCalledWith('The Aurora House');
  });

  it('moves to children once a family exists', () => {
    setup({ family: FAMILY });
    expect(screen.getByLabelText(/child's nickname/i)).toBeInTheDocument();
  });

  it('tells the parent plainly not to enter the child\'s real name', () => {
    setup({ family: FAMILY });
    expect(screen.getByText(/real name/i)).toBeInTheDocument();
  });

  it('adds a child and clears the field for the next one', async () => {
    const { onAddChild, user } = setup({ family: FAMILY });

    await user.type(screen.getByLabelText(/child's nickname/i), 'Sparrow');
    await user.click(screen.getByRole('button', { name: /add child/i }));

    expect(onAddChild).toHaveBeenCalledWith('Sparrow');
    expect(screen.getByLabelText(/child's nickname/i)).toHaveValue('');
  });

  it('lists children as they are added', async () => {
    const { user } = setup({ family: FAMILY });

    await user.type(screen.getByLabelText(/child's nickname/i), 'Sparrow');
    await user.click(screen.getByRole('button', { name: /add child/i }));

    expect(screen.getByRole('list', { name: /children added/i })).toHaveTextContent('Sparrow');
  });

  it('offers no way out until at least one child exists', async () => {
    const { user } = setup({ family: FAMILY });

    expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/child's nickname/i), 'Sparrow');
    await user.click(screen.getByRole('button', { name: /add child/i }));

    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });

  it('reports a failure instead of pretending it saved', async () => {
    const onAddChild = vi.fn(() => Promise.reject(new Error('permission-denied')));
    render(
      <Onboarding family={FAMILY} onCreateFamily={vi.fn()} onAddChild={onAddChild} onLeave={vi.fn()} />
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/child's nickname/i), 'Sparrow');
    await user.click(screen.getByRole('button', { name: /add child/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/could not save/i);
  });
});

describe('leaving the add-children step', () => {
  const FAMILY_WITH_CHILDREN = { id: 'fam1', name: 'The Aurora House' };

  it('offers Back when a parent arrives from a family that already has children', () => {
    setup({ family: FAMILY_WITH_CHILDREN, childCount: 2 });

    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^done$/i })).not.toBeInTheDocument();
  });

  it('turns Back into Done once this visit has added somebody', async () => {
    const { user } = setup({ family: FAMILY_WITH_CHILDREN, childCount: 2 });

    await user.type(screen.getByLabelText(/child's nickname/i), 'Robin');
    await user.click(screen.getByRole('button', { name: /add child/i }));

    expect(screen.getByRole('button', { name: /^done$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument();
  });

  /**
   * The count comes from a subscription, so it lags the write. Waiting for it
   * would blink the only way out of this screen in a moment after the child
   * appeared in the list above it.
   */
  it('offers Done immediately, without waiting for the count to catch up', async () => {
    const { user } = setup({ family: FAMILY_WITH_CHILDREN, childCount: 0 });

    await user.type(screen.getByLabelText(/child's nickname/i), 'Sparrow');
    await user.click(screen.getByRole('button', { name: /add child/i }));

    expect(screen.getByRole('button', { name: /^done$/i })).toBeInTheDocument();
  });

  it('leaves the step when that button is used', async () => {
    const { onLeave, user } = setup({ family: FAMILY_WITH_CHILDREN, childCount: 1 });
    await user.click(screen.getByRole('button', { name: /^back$/i }));

    expect(onLeave).toHaveBeenCalled();
  });

  it('offers exactly one way out, never both', async () => {
    const { user } = setup({ family: FAMILY_WITH_CHILDREN, childCount: 3 });
    await user.type(screen.getByLabelText(/child's nickname/i), 'Robin');
    await user.click(screen.getByRole('button', { name: /add child/i }));

    const exits = screen.getAllByRole('button')
      .filter((button) => /^(done|back)$/i.test(button.textContent.trim()));
    expect(exits).toHaveLength(1);
  });
});

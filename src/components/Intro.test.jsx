import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Intro } from './Intro.jsx';
import { CHILD_SESSIONS_DISABLED, SESSION_UNAVAILABLE, sessionFailure } from '../data/session.js';

const scene = () => screen.getByRole('button', { name: 'Continue' });
const pairLink = () => screen.getByRole('button', { name: /pair it with a code|starting/i });

describe("Aurora's greeting", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // Comfortably longer than the slowest line at 22ms/character.
  const finishTyping = () => act(() => vi.advanceTimersByTime(5000));

  it('greets with the first line, fully typed', () => {
    render(<Intro onPairDevice={vi.fn()} />);
    finishTyping();
    expect(screen.getByText('Hi, welcome to AuroraCoin!')).toBeInTheDocument();
  });

  it('offers to continue only once the line has finished typing', () => {
    render(<Intro onPairDevice={vi.fn()} />);
    expect(screen.queryByText(/tap\/click to continue/i)).not.toBeInTheDocument();

    finishTyping();
    expect(screen.getByText(/tap\/click to continue/i)).toBeInTheDocument();
  });

  it('a tap while typing finishes the line rather than skipping it', () => {
    render(<Intro onPairDevice={vi.fn()} />);
    act(() => vi.advanceTimersByTime(22)); // one character in

    fireEvent.click(scene());

    expect(screen.getByText('Hi, welcome to AuroraCoin!')).toBeInTheDocument();
  });

  it('advances to the next line on tap once the current one is done', () => {
    render(<Intro onPairDevice={vi.fn()} />);
    finishTyping();
    fireEvent.click(scene());
    finishTyping();

    expect(screen.getByText(/teaches your kids financial responsibility/)).toBeInTheDocument();
  });

  it('settles on the closing reminder and stops responding to taps', () => {
    render(<Intro onPairDevice={vi.fn()} />);

    for (let clicks = 0; clicks < 6; clicks += 1) {
      finishTyping();
      fireEvent.click(scene());
    }
    finishTyping();

    expect(screen.getByText(/never input any personal information/)).toBeInTheDocument();
    expect(screen.queryByText(/tap\/click to continue/i)).not.toBeInTheDocument();

    fireEvent.click(scene());
    expect(screen.getByText(/never input any personal information/)).toBeInTheDocument();
  });
});

describe('starting a child device', () => {
  const setup = (overrides = {}) => {
    const handlers = { onPairDevice: vi.fn(() => Promise.resolve()), ...overrides };
    render(<Intro {...handlers} />);
    return { ...handlers, user: userEvent.setup() };
  };

  it('begins a session when the pairing link is used', async () => {
    const { onPairDevice, user } = setup();
    await user.click(pairLink());

    expect(onPairDevice).toHaveBeenCalled();
  });

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
    release();
  });
});

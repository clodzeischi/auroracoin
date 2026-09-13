import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypewriter } from './useTypewriter.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useTypewriter', () => {
  it('starts with nothing revealed', () => {
    const { result } = renderHook(() => useTypewriter('Hi!'));
    expect(result.current.shown).toBe('');
    expect(result.current.done).toBe(false);
  });

  it('reveals one more character per tick', () => {
    const { result } = renderHook(() => useTypewriter('Hi!'));

    act(() => vi.advanceTimersByTime(22));
    expect(result.current.shown).toBe('H');

    act(() => vi.advanceTimersByTime(22));
    expect(result.current.shown).toBe('Hi');
  });

  it('marks done once fully revealed, and stops changing after that', () => {
    const { result } = renderHook(() => useTypewriter('Hi!'));

    act(() => vi.advanceTimersByTime(22 * 3));
    expect(result.current.shown).toBe('Hi!');
    expect(result.current.done).toBe(true);

    act(() => vi.advanceTimersByTime(22 * 5));
    expect(result.current.shown).toBe('Hi!');
  });

  it('finish() reveals the rest immediately', () => {
    const { result } = renderHook(() => useTypewriter('Hello'));

    act(() => vi.advanceTimersByTime(22));
    expect(result.current.shown).toBe('H');

    act(() => result.current.finish());
    expect(result.current.shown).toBe('Hello');
    expect(result.current.done).toBe(true);
  });

  it('resets and retypes when the text changes', () => {
    const { result, rerender } = renderHook(({ text }) => useTypewriter(text), {
      initialProps: { text: 'Hi' },
    });
    act(() => vi.advanceTimersByTime(22 * 2));
    expect(result.current.shown).toBe('Hi');

    rerender({ text: 'Bye' });
    expect(result.current.shown).toBe('');

    act(() => vi.advanceTimersByTime(22));
    expect(result.current.shown).toBe('B');
  });

  it('treats an empty string as already done', () => {
    const { result } = renderHook(() => useTypewriter(''));
    expect(result.current.shown).toBe('');
    expect(result.current.done).toBe(true);
  });
});

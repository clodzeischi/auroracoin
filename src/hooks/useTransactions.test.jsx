import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactions } from './useTransactions.js';
import { createFakeBackend, tx } from '../test/fakeBackend.js';

describe('useTransactions', () => {
  it('starts in a loading state before the first snapshot arrives', () => {
    const backend = createFakeBackend();
    const { result } = renderHook(() => useTransactions(backend));

    expect(result.current.loading).toBe(true);
    expect(result.current.transactions).toEqual([]);
  });

  it('exposes transactions once a snapshot arrives and clears loading', () => {
    const backend = createFakeBackend();
    const { result } = renderHook(() => useTransactions(backend));

    act(() => backend.emitTransactions([tx({ id: 'a' }), tx({ id: 'b' })]));

    expect(result.current.loading).toBe(false);
    expect(result.current.transactions).toHaveLength(2);
  });

  it('sums amounts into a running total', () => {
    const backend = createFakeBackend();
    const { result } = renderHook(() => useTransactions(backend));

    act(() =>
      backend.emitTransactions([tx({ amountMinor: 5 }), tx({ amountMinor: 12 }), tx({ amountMinor: -3 })])
    );

    expect(result.current.totalMinor).toBe(14);
  });

  it('ignores non-numeric amounts so one malformed document cannot NaN the total', () => {
    const backend = createFakeBackend();
    const { result } = renderHook(() => useTransactions(backend));

    act(() =>
      backend.emitTransactions([
        tx({ amountMinor: 10 }),
        tx({ amountMinor: undefined }),
        tx({ amountMinor: 'twelve' }),
        tx({ amountMinor: 5 }),
      ])
    );

    expect(result.current.totalMinor).toBe(15);
  });

  it('surfaces a subscription error instead of silently showing a zero balance', () => {
    const backend = createFakeBackend();
    const { result } = renderHook(() => useTransactions(backend));

    act(() => backend.emitTransactionsError(new Error('permission-denied')));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.loading).toBe(false);
  });

  it('unsubscribes on unmount', () => {
    const backend = createFakeBackend();
    const { unmount } = renderHook(() => useTransactions(backend));

    unmount();

    expect(backend.unsubscribeTransactions).toHaveBeenCalledTimes(1);
  });

  it('does not resubscribe on every render', () => {
    const backend = createFakeBackend();
    const { rerender } = renderHook(() => useTransactions(backend));

    rerender();
    rerender();

    expect(backend.subscribeToTransactions).toHaveBeenCalledTimes(1);
  });
});

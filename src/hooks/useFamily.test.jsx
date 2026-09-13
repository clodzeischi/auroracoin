import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFamily } from './useFamily.js';

const stubBackend = () => {
  let familyOnData = null;
  const childrenCalls = [];
  return {
    unsubscribeFamily: vi.fn(),
    subscribeToFamily: vi.fn(function (_uid, data) {
      familyOnData = data;
      return this.unsubscribeFamily;
    }),
    subscribeToChildren: vi.fn(function (_familyId, onData, onError) {
      const unsubscribe = vi.fn();
      childrenCalls.push({ onData, onError, unsubscribe });
      return unsubscribe;
    }),
    emitFamily: (family) => act(() => familyOnData(family)),
    emitChildren: (attempt, children) => act(() => childrenCalls[attempt].onData(children)),
    failChildren: (attempt, error) => act(() => childrenCalls[attempt].onError(error)),
    childrenCalls,
  };
};

const FAMILY = { id: 'fam1', name: 'The Aurora House' };
const denied = () => Object.assign(new Error('denied'), { code: 'permission-denied' });

describe('useFamily', () => {
  /**
   * subscribeToChildren's rule does a get() on the family document, and that
   * can transiently deny right after createFamily - Firestore's rule
   * evaluation can lag a beat behind a write it has not propagated to yet.
   * onSnapshot treats permission-denied as terminal, so without a retry a
   * family created moments ago would look permanently childless.
   */
  it('retries the children subscription after a permission-denied error', () => {
    vi.useFakeTimers();
    const backend = stubBackend();
    const { result } = renderHook(() => useFamily(backend, { uid: 'parent-1' }));
    backend.emitFamily(FAMILY);

    expect(backend.childrenCalls).toHaveLength(1);
    backend.failChildren(0, denied());

    // Not surfaced as an error yet - it retries first.
    expect(result.current.error).toBeNull();

    act(() => vi.advanceTimersByTime(1000));
    expect(backend.childrenCalls).toHaveLength(2);

    backend.emitChildren(1, [{ id: 'child1', name: 'Sparrow' }]);
    expect(result.current.children).toEqual([{ id: 'child1', name: 'Sparrow' }]);
    expect(result.current.error).toBeNull();

    vi.useRealTimers();
  });

  it('gives up and surfaces the error after repeated denials', () => {
    vi.useFakeTimers();
    const backend = stubBackend();
    const { result } = renderHook(() => useFamily(backend, { uid: 'parent-1' }));
    backend.emitFamily(FAMILY);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      backend.failChildren(attempt, denied());
      act(() => vi.advanceTimersByTime(5000));
    }

    expect(result.current.error).toBeTruthy();
    expect(result.current.children).toEqual([]);

    vi.useRealTimers();
  });

  it('does not retry a non-transient error', () => {
    vi.useFakeTimers();
    const backend = stubBackend();
    const { result } = renderHook(() => useFamily(backend, { uid: 'parent-1' }));
    backend.emitFamily(FAMILY);

    backend.failChildren(0, new Error('offline'));
    act(() => vi.advanceTimersByTime(5000));

    expect(backend.childrenCalls).toHaveLength(1);
    expect(result.current.error).toBeTruthy();

    vi.useRealTimers();
  });

  it('abandons a pending retry on unmount', () => {
    vi.useFakeTimers();
    const backend = stubBackend();
    const { unmount } = renderHook(() => useFamily(backend, { uid: 'parent-1' }));
    backend.emitFamily(FAMILY);
    backend.failChildren(0, denied());

    unmount();
    act(() => vi.advanceTimersByTime(5000));

    expect(backend.childrenCalls).toHaveLength(1);

    vi.useRealTimers();
  });
});

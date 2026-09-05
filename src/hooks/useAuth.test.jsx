import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth.js';
import { createFakeBackend } from '../test/fakeBackend.js';

describe('useAuth', () => {
  it('reports loading until the first auth callback, so the UI does not flash the login button', () => {
    const backend = createFakeBackend();
    const { result } = renderHook(() => useAuth(backend));

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('distinguishes "signed out" from "still checking"', () => {
    const backend = createFakeBackend();
    const { result } = renderHook(() => useAuth(backend));

    act(() => backend.emitAuth(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('exposes the signed-in user', () => {
    const backend = createFakeBackend();
    const { result } = renderHook(() => useAuth(backend));

    act(() => backend.emitAuth({ email: 'parent@example.com' }));

    expect(result.current.user).toMatchObject({ email: 'parent@example.com' });
    expect(result.current.loading).toBe(false);
  });

  it('delegates login and logout to the backend', async () => {
    const backend = createFakeBackend();
    const { result } = renderHook(() => useAuth(backend));

    await act(() => result.current.login());
    await act(() => result.current.logout());

    expect(backend.login).toHaveBeenCalledTimes(1);
    expect(backend.logout).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const backend = createFakeBackend();
    const { unmount } = renderHook(() => useAuth(backend));

    unmount();

    expect(backend.unsubscribeAuth).toHaveBeenCalledTimes(1);
  });
});

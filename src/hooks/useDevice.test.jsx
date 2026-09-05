import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDevice } from './useDevice.js';

const stubBackend = () => {
  let onData = null;
  let onError = null;
  return {
    unsubscribe: vi.fn(),
    subscribeToDevice: vi.fn(function (_uid, data, error) {
      onData = data;
      onError = error;
      return this.unsubscribe;
    }),
    emit: (device) => act(() => onData(device)),
    fail: () => act(() => onError(new Error('permission-denied'))),
  };
};

const DEVICE = { id: 'device-1', familyId: 'fam1', childId: 'kid1' };

describe('useDevice', () => {
  it('waits before deciding a device is unpaired', () => {
    const backend = stubBackend();
    const { result } = renderHook(() => useDevice(backend, 'device-1'));

    // The unpaired screen and the paired one look nothing alike, so showing
    // either before the record arrives would flash the wrong app at a child.
    expect(result.current.loading).toBe(true);
    expect(result.current.device).toBeNull();
  });

  it('reports the pairing once it arrives', () => {
    const backend = stubBackend();
    const { result } = renderHook(() => useDevice(backend, 'device-1'));
    backend.emit(DEVICE);

    expect(result.current).toEqual({ device: DEVICE, loading: false });
  });

  it('settles on unpaired rather than loading forever', () => {
    const backend = stubBackend();
    const { result } = renderHook(() => useDevice(backend, 'device-1'));
    backend.emit(null);

    expect(result.current).toEqual({ device: null, loading: false });
  });

  it('does not subscribe at all without a uid', () => {
    const backend = stubBackend();
    const { result } = renderHook(() => useDevice(backend, null));

    expect(backend.subscribeToDevice).not.toHaveBeenCalled();
    expect(result.current).toEqual({ device: null, loading: false });
  });

  /**
   * A device whose record cannot be read - revoked, or rules changed under it -
   * must land on the pairing screen, which is recoverable, rather than a
   * spinner that never resolves.
   */
  it('treats a failed read as unpaired', () => {
    const backend = stubBackend();
    const { result } = renderHook(() => useDevice(backend, 'device-1'));
    backend.fail();

    expect(result.current).toEqual({ device: null, loading: false });
  });

  it('lets go of the subscription when it unmounts', () => {
    const backend = stubBackend();
    const { unmount } = renderHook(() => useDevice(backend, 'device-1'));
    unmount();

    expect(backend.unsubscribe).toHaveBeenCalled();
  });

  it('re-subscribes when the session changes identity', () => {
    const backend = stubBackend();
    const { rerender } = renderHook(({ uid }) => useDevice(backend, uid), {
      initialProps: { uid: 'device-1' },
    });
    rerender({ uid: 'device-2' });

    expect(backend.unsubscribe).toHaveBeenCalledTimes(1);
    expect(backend.subscribeToDevice).toHaveBeenLastCalledWith(
      'device-2', expect.any(Function), expect.any(Function)
    );
  });
});

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoSave } from './useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls callback after delay when triggered', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useAutoSave(callback, 300));

    act(() => { result.current.trigger(); });
    expect(callback).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });
    expect(callback).toHaveBeenCalledOnce();
  });

  it('debounces multiple triggers', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useAutoSave(callback, 300));

    act(() => { result.current.trigger(); });
    act(() => { vi.advanceTimersByTime(200); });
    act(() => { result.current.trigger(); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(callback).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(100); });
    expect(callback).toHaveBeenCalledOnce();
  });

  it('flush fires immediately and clears pending timer', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useAutoSave(callback, 300));

    act(() => { result.current.trigger(); });
    expect(result.current.isPending).toBe(true);

    act(() => { result.current.flush(); });
    expect(callback).toHaveBeenCalledOnce();
    expect(result.current.isPending).toBe(false);

    // Should not fire again after delay
    act(() => { vi.advanceTimersByTime(300); });
    expect(callback).toHaveBeenCalledOnce();
  });

  it('flush does nothing when no pending trigger', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useAutoSave(callback, 300));

    act(() => { result.current.flush(); });
    expect(callback).not.toHaveBeenCalled();
  });

  it('isPending reflects timer state', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useAutoSave(callback, 300));

    expect(result.current.isPending).toBe(false);

    act(() => { result.current.trigger(); });
    expect(result.current.isPending).toBe(true);

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.isPending).toBe(false);
  });

  it('cleans up timer on unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useAutoSave(callback, 300));

    act(() => { result.current.trigger(); });
    unmount();
    act(() => { vi.advanceTimersByTime(300); });
    expect(callback).not.toHaveBeenCalled();
  });

  it('uses latest callback ref', () => {
    let callCount = 0;
    const callback1 = vi.fn(() => { callCount = 1; });
    const callback2 = vi.fn(() => { callCount = 2; });

    const { result, rerender } = renderHook(
      ({ cb }) => useAutoSave(cb, 300),
      { initialProps: { cb: callback1 } },
    );

    act(() => { result.current.trigger(); });
    rerender({ cb: callback2 });
    act(() => { vi.advanceTimersByTime(300); });

    expect(callCount).toBe(2);
    expect(callback2).toHaveBeenCalledOnce();
  });
});

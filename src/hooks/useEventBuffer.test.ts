import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEventBuffer } from './useEventBuffer';

describe('useEventBuffer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('flushes accumulated items on interval', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useEventBuffer<string>(100, onFlush));

    act(() => { result.current.push('a'); });
    act(() => { result.current.push('b'); });
    expect(onFlush).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(100); });
    expect(onFlush).toHaveBeenCalledWith(['a', 'b']);
  });

  it('does not flush when buffer is empty', () => {
    const onFlush = vi.fn();
    renderHook(() => useEventBuffer<string>(100, onFlush));

    act(() => { vi.advanceTimersByTime(100); });
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('clears buffer after flush', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useEventBuffer<string>(100, onFlush));

    act(() => { result.current.push('a'); });
    act(() => { vi.advanceTimersByTime(100); });
    expect(onFlush).toHaveBeenCalledWith(['a']);

    act(() => { vi.advanceTimersByTime(100); });
    // Should not flush again — buffer was cleared
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('pushMany adds multiple items', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useEventBuffer<number>(100, onFlush));

    act(() => { result.current.pushMany([1, 2, 3]); });
    act(() => { result.current.push(4); });
    act(() => { vi.advanceTimersByTime(100); });
    expect(onFlush).toHaveBeenCalledWith([1, 2, 3, 4]);
  });

  it('cleans up interval on unmount', () => {
    const onFlush = vi.fn();
    const { result, unmount } = renderHook(() => useEventBuffer<string>(100, onFlush));

    act(() => { result.current.push('a'); });
    unmount();
    act(() => { vi.advanceTimersByTime(100); });
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('flushes multiple times across intervals', () => {
    const onFlush = vi.fn();
    const { result } = renderHook(() => useEventBuffer<string>(100, onFlush));

    act(() => { result.current.push('a'); });
    act(() => { vi.advanceTimersByTime(100); });
    expect(onFlush).toHaveBeenCalledWith(['a']);

    act(() => { result.current.push('b'); });
    act(() => { result.current.push('c'); });
    act(() => { vi.advanceTimersByTime(100); });
    expect(onFlush).toHaveBeenCalledWith(['b', 'c']);
    expect(onFlush).toHaveBeenCalledTimes(2);
  });

  it('uses latest onFlush ref', () => {
    const onFlush1 = vi.fn();
    const onFlush2 = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useEventBuffer<string>(100, cb),
      { initialProps: { cb: onFlush1 } },
    );

    act(() => { result.current.push('a'); });
    rerender({ cb: onFlush2 });
    act(() => { vi.advanceTimersByTime(100); });
    expect(onFlush1).not.toHaveBeenCalled();
    expect(onFlush2).toHaveBeenCalledWith(['a']);
  });
});

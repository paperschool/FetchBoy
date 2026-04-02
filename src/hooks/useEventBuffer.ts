import { useRef, useCallback, useEffect } from 'react';

interface UseEventBufferReturn<T> {
  push: (item: T) => void;
  pushMany: (items: T[]) => void;
}

/**
 * Accumulates items in a ref-based buffer and flushes them on an interval.
 * Items are batched to reduce store update frequency for high-throughput events.
 */
export function useEventBuffer<T>(
  flushInterval: number,
  onFlush: (items: T[]) => void,
): UseEventBufferReturn<T> {
  const bufferRef = useRef<T[]>([]);
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (bufferRef.current.length === 0) return;
      const items = bufferRef.current;
      bufferRef.current = [];
      onFlushRef.current(items);
    }, flushInterval);

    return () => clearInterval(intervalId);
  }, [flushInterval]);

  const push = useCallback((item: T): void => {
    bufferRef.current.push(item);
  }, []);

  const pushMany = useCallback((items: T[]): void => {
    bufferRef.current.push(...items);
  }, []);

  return { push, pushMany };
}

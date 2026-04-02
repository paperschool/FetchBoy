import { useRef, useCallback, useEffect, useState } from 'react';

interface UseAutoSaveReturn {
  trigger: () => void;
  flush: () => void;
  isPending: boolean;
}

/**
 * Debounced auto-save hook. Call `trigger()` whenever the data changes;
 * the callback fires after `delay` ms of inactivity. `flush()` fires immediately.
 */
export function useAutoSave(
  callback: () => void | Promise<void>,
  delay: number = 300,
): UseAutoSaveReturn {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const fire = useCallback(() => {
    timerRef.current = null;
    setIsPending(false);
    void callbackRef.current();
  }, []);

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPending(true);
    timerRef.current = setTimeout(fire, delay);
  }, [delay, fire]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      fire();
    }
  }, [fire]);

  return { trigger, flush, isPending };
}

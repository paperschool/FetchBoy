import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

/**
 * Hook that subscribes to a Tauri event and automatically cleans up on unmount.
 * Handles the common listen → then(unlisten) → catch(console.error) pattern.
 */
export function useTauriListener<T>(
  eventName: string,
  handler: (payload: T) => void,
): void {
  const unlistenRef = useRef<UnlistenFn | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    listen<T>(eventName, (event) => {
      handler(event.payload);
    })
      .then((fn) => {
        if (cancelled) fn();
        else unlistenRef.current = fn;
      })
      .catch((err) => {
        console.error(`[useTauriListener] Failed to register ${eventName}:`, err);
      });

    return () => {
      cancelled = true;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = undefined;
      }
    };
  // handler is intentionally excluded — callers should use stable references
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName]);
}

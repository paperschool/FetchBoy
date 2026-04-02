import { useDebugStore } from '@/stores/debugStore';

/** Emit a debug event to the internal debug log. */
export function emitDebug(
  level: 'info' | 'warn' | 'error',
  source: string,
  message: string,
): void {
  useDebugStore.getState().addInternalEvent({
    id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    level,
    source,
    message,
  });
}

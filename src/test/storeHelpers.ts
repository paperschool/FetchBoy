import type { StoreApi } from 'zustand';

/**
 * Reset a Zustand store to its initial state by calling setState with initial values.
 * Usage: resetStore(useMyStore, { count: 0, items: [] })
 */
export function resetStore<T>(
  store: StoreApi<T>,
  initialState: Partial<T>,
): void {
  store.setState(initialState as T, true);
}

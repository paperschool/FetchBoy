// ─── Array size limits ────────────────────────────────────────────────────────

export const MAX_DEBUG_ENTRIES = 1000;
export const MAX_MAPPING_LOG_ENTRIES = 500;
export const MAX_HISTORY_ENTRIES = 200;
export const MAX_INTERCEPT_ENTRIES = 5000;

/** Interval (ms) at which buffered intercept events are flushed to the store. */
export const INTERCEPT_FLUSH_INTERVAL_MS = 100;

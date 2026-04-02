// ─── Array size limits ────────────────────────────────────────────────────────

export const MAX_DEBUG_ENTRIES = 1000;
export const MAX_MAPPING_LOG_ENTRIES = 500;
export const MAX_HISTORY_ENTRIES = 200;
export const MAX_INTERCEPT_ENTRIES = 5000;

/** Interval (ms) at which buffered intercept events are flushed to the store. */
export const INTERCEPT_FLUSH_INTERVAL_MS = 100;

// ── TIMEOUTS ────────────────────────────────────────────────────────────────

export const INTERCEPT_BANNER_TIMEOUT_MS = 5000;
export const PROGRESS_BAR_FADEOUT_MS = 300;
export const COPY_FEEDBACK_TIMEOUT_MS = 1500;
export const SCRIPT_EXECUTION_TIMEOUT_MS = 5000;
export const INVOKE_TIMEOUT_BUFFER_MS = 5000;
export const DEFAULT_LOOP_DELAY_MS = 100;
export const TOUR_STEP_TRANSITION_DELAY_MS = 50;
export const TABLE_REMEASURE_DEBOUNCE_MS = 50;
export const AUTO_SAVE_DEBOUNCE_MS = 800;
export const AUTO_SAVE_DISPLAY_MS = 2000;

// ── PROGRESS ────────────────────────────────────────────────────────────────

export const PROGRESS_MAX_BEFORE_COMPLETE = 80;
export const PROGRESS_INCREMENT_PER_TICK = 10;
export const PROGRESS_UPDATE_INTERVAL_MS = 200;

// ── UI DIMENSIONS ───────────────────────────────────────────────────────────

export const DEFAULT_SPLIT_PANE_PERCENT = 60;
export const SPLIT_PANE_MIN_PX = 120;
export const TABLET_BREAKPOINT_PX = 768;
export const INTERCEPT_TABLE_ROW_HEIGHT = 40;
export const VIRTUALIZER_OVERSCAN_COUNT = 10;
export const TRAFFIC_TABLE_ROW_HEIGHT = 32;
export const HISTORY_LABEL_MAX_LENGTH = 30;
export const SIDEBAR_COLLAPSED_WIDTH = '3.5rem';
export const SIDEBAR_EXPANDED_WIDTH = '16rem';

// ── CANVAS ──────────────────────────────────────────────────────────────────

export const CANVAS_MIN_ZOOM = 0.25;
export const CANVAS_MAX_ZOOM = 2.0;
export const CANVAS_ZOOM_STEP = 0.1;

// ── SETTINGS DEFAULTS ───────────────────────────────────────────────────────

export const DEFAULT_PROXY_PORT = 8080;
export const DEFAULT_EDITOR_FONT_SIZE = 13;
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
export const MIN_REQUEST_TIMEOUT_MS = 100;
export const MAX_REQUEST_TIMEOUT_MS = 300000;
export const MIN_EDITOR_FONT_SIZE = 10;
export const MAX_EDITOR_FONT_SIZE = 24;
export const MIN_PROXY_PORT = 1024;
export const MAX_PROXY_PORT = 65535;

// ── REGEX PATTERNS ──────────────────────────────────────────────────────────

export const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;

// ── MISC ────────────────────────────────────────────────────────────────────

export const SAMPLE_COLLECTION_ID = 'sample-getting-started';
export const DEFAULT_TARGET_SLOT = 'input';

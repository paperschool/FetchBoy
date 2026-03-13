CREATE TABLE IF NOT EXISTS paused_requests (
    id TEXT PRIMARY KEY,
    request_data TEXT NOT NULL,
    breakpoint_id TEXT NOT NULL,
    paused_at TEXT NOT NULL,
    timeout_at TEXT NOT NULL,
    status TEXT DEFAULT 'paused'
);

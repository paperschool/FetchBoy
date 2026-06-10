-- Proxy ignore rules: URL-match rules that cause the proxy to bypass a request
-- entirely (not captured, not paused by breakpoints, not rewritten by mappings).
-- Mirrors the match subset of 007_mappings.sql; no headers/cookies/response/remap.
CREATE TABLE IF NOT EXISTS ignore_rules (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL DEFAULT 'New Ignore Rule',
    url_pattern TEXT NOT NULL DEFAULT '',
    match_type  TEXT NOT NULL DEFAULT 'partial',  -- 'exact' | 'partial' | 'wildcard' | 'regex'
    enabled     INTEGER NOT NULL DEFAULT 1,        -- boolean stored as int (0/1)
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

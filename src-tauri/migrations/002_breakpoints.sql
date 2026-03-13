-- Migration v2: Breakpoints tables for intercept breakpoint management

CREATE TABLE IF NOT EXISTS breakpoint_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS breakpoints (
  id TEXT PRIMARY KEY,
  folder_id TEXT REFERENCES breakpoint_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url_pattern TEXT NOT NULL DEFAULT '',
  match_type TEXT NOT NULL DEFAULT 'partial',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

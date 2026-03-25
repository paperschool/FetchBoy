-- Mapping folders (groups of request mappings)
CREATE TABLE IF NOT EXISTS mapping_folders (
    id         TEXT PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL DEFAULT 'New Folder',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Request mappings (persistent response overrides)
CREATE TABLE IF NOT EXISTS mappings (
    id                         TEXT PRIMARY KEY NOT NULL,
    folder_id                  TEXT,
    name                       TEXT NOT NULL DEFAULT 'New Mapping',
    url_pattern                TEXT NOT NULL DEFAULT '',
    match_type                 TEXT NOT NULL DEFAULT 'partial',
    enabled                    INTEGER NOT NULL DEFAULT 1,
    headers_add                TEXT NOT NULL DEFAULT '[]',
    headers_remove             TEXT NOT NULL DEFAULT '[]',
    cookies                    TEXT NOT NULL DEFAULT '[]',
    response_body_enabled      INTEGER NOT NULL DEFAULT 0,
    response_body              TEXT NOT NULL DEFAULT '',
    response_body_content_type TEXT NOT NULL DEFAULT 'application/json',
    response_body_file_path    TEXT NOT NULL DEFAULT '',
    url_remap_enabled          INTEGER NOT NULL DEFAULT 0,
    url_remap_target           TEXT NOT NULL DEFAULT '',
    created_at                 TEXT NOT NULL,
    updated_at                 TEXT NOT NULL,
    FOREIGN KEY (folder_id) REFERENCES mapping_folders(id) ON DELETE SET NULL
);

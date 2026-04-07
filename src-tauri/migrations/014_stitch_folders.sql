-- Stitch folder tree: organise chains into folders
CREATE TABLE IF NOT EXISTS stitch_folders (
    id TEXT PRIMARY KEY NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL DEFAULT 'New Folder',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Add folder_id and sort_order to stitch_chains
ALTER TABLE stitch_chains ADD COLUMN folder_id TEXT;
ALTER TABLE stitch_chains ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Migration v17: Collection-wide ("global") pre-request script.
-- Runs before every request in the collection. Enabled by default once set.
ALTER TABLE collections ADD COLUMN pre_request_script TEXT NOT NULL DEFAULT '';
ALTER TABLE collections ADD COLUMN pre_request_script_enabled INTEGER NOT NULL DEFAULT 1;

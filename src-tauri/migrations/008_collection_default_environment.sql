-- Migration v8: Add default_environment_id to collections
ALTER TABLE collections ADD COLUMN default_environment_id TEXT REFERENCES environments(id) ON DELETE SET NULL;

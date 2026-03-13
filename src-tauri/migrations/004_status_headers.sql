-- Migration v4: Add status code and custom headers fields to breakpoints table

ALTER TABLE breakpoints ADD COLUMN status_code_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE breakpoints ADD COLUMN status_code_value INTEGER NOT NULL DEFAULT 200;
ALTER TABLE breakpoints ADD COLUMN custom_headers TEXT NOT NULL DEFAULT '[]';

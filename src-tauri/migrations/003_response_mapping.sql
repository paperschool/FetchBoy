-- Migration v3: Add response mapping fields to breakpoints table

ALTER TABLE breakpoints ADD COLUMN response_mapping_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE breakpoints ADD COLUMN response_mapping_body TEXT NOT NULL DEFAULT '';
ALTER TABLE breakpoints ADD COLUMN response_mapping_content_type TEXT NOT NULL DEFAULT 'application/json';

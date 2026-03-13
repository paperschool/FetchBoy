-- Story 10.7: Add request blocking columns to breakpoints table
ALTER TABLE breakpoints ADD COLUMN block_request_enabled BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE breakpoints ADD COLUMN block_request_status_code INTEGER NOT NULL DEFAULT 501;
ALTER TABLE breakpoints ADD COLUMN block_request_body TEXT NOT NULL DEFAULT '';

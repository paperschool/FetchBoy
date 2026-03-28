-- Migration v9: Add pre-request script columns to requests
ALTER TABLE requests ADD COLUMN pre_request_script TEXT NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN pre_request_script_enabled INTEGER NOT NULL DEFAULT 1;

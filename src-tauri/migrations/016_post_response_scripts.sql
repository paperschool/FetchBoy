-- Migration v16: Add post-response (test) script columns to requests.
-- Opt-in: disabled by default (unlike pre-request scripts which default enabled).
ALTER TABLE requests ADD COLUMN post_response_script TEXT NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN post_response_script_enabled INTEGER NOT NULL DEFAULT 0;

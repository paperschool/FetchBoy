-- Migration v19: Track which collection auto-created an environment on import.
-- NULL = shared / manually-created → never auto-deleted. On collection delete,
-- an owned environment is removed only if no other collection still references it.
ALTER TABLE environments ADD COLUMN owner_collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL;

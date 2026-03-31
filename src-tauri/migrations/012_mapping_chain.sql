-- Add use_chain flag to mappings
ALTER TABLE mappings ADD COLUMN use_chain INTEGER NOT NULL DEFAULT 0;
-- Add chain_id linking mapping to stitch chain (nullable, only set when use_chain=1)
ALTER TABLE mappings ADD COLUMN chain_id TEXT REFERENCES stitch_chains(id) ON DELETE SET NULL;

-- Add mapping_id to stitch_chains for reverse lookup
ALTER TABLE stitch_chains ADD COLUMN mapping_id TEXT REFERENCES mappings(id) ON DELETE SET NULL;

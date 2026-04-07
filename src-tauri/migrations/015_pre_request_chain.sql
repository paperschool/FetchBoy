-- Pre-request chain: link a stitch chain as pre-request alternative
ALTER TABLE requests ADD COLUMN pre_request_chain_id TEXT;
ALTER TABLE stitch_chains ADD COLUMN request_id TEXT;

-- Stitch: node-based request chain builder

CREATE TABLE IF NOT EXISTS stitch_chains (
    id         TEXT PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stitch_nodes (
    id         TEXT PRIMARY KEY NOT NULL,
    chain_id   TEXT NOT NULL REFERENCES stitch_chains(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    position_x REAL NOT NULL DEFAULT 0,
    position_y REAL NOT NULL DEFAULT 0,
    config     TEXT NOT NULL DEFAULT '{}',
    label      TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stitch_connections (
    id             TEXT PRIMARY KEY NOT NULL,
    chain_id       TEXT NOT NULL REFERENCES stitch_chains(id) ON DELETE CASCADE,
    source_node_id TEXT NOT NULL REFERENCES stitch_nodes(id) ON DELETE CASCADE,
    source_key     TEXT,
    target_node_id TEXT NOT NULL REFERENCES stitch_nodes(id) ON DELETE CASCADE,
    target_slot    TEXT,
    created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stitch_nodes_chain_id ON stitch_nodes(chain_id);
CREATE INDEX IF NOT EXISTS idx_stitch_connections_chain_id ON stitch_connections(chain_id);
CREATE INDEX IF NOT EXISTS idx_stitch_connections_source ON stitch_connections(source_node_id);
CREATE INDEX IF NOT EXISTS idx_stitch_connections_target ON stitch_connections(target_node_id);

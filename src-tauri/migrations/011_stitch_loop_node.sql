-- Add parent_node_id to stitch_nodes for loop container relationships
ALTER TABLE stitch_nodes ADD COLUMN parent_node_id TEXT REFERENCES stitch_nodes(id) ON DELETE CASCADE;
CREATE INDEX idx_stitch_nodes_parent ON stitch_nodes(parent_node_id);

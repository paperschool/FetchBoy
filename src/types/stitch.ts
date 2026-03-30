// ─── Stitch Node Types ──────────────────────────────────────────────────────

export type StitchNodeType = 'request' | 'json-object' | 'js-snippet' | 'sleep';

export type StitchExecutionState = 'idle' | 'running' | 'paused' | 'completed' | 'error';

// ─── Domain Interfaces ──────────────────────────────────────────────────────

export interface StitchChain {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface StitchNode {
  id: string;
  chainId: string;
  type: StitchNodeType;
  positionX: number;
  positionY: number;
  config: Record<string, unknown>;
  label: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StitchConnection {
  id: string;
  chainId: string;
  sourceNodeId: string;
  sourceKey: string | null;
  targetNodeId: string;
  targetSlot: string | null;
  createdAt: string;
}

// ─── Raw DB Row Interfaces ──────────────────────────────────────────────────

export interface RawStitchChain {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface RawStitchNode {
  id: string;
  chain_id: string;
  type: string;
  position_x: number;
  position_y: number;
  config: string;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawStitchConnection {
  id: string;
  chain_id: string;
  source_node_id: string;
  source_key: string | null;
  target_node_id: string;
  target_slot: string | null;
  created_at: string;
}

import { getDb } from '@/lib/db';
import { now, parseJsonField, insertOne, buildUpdate } from '@/lib/dbHelpers';
import type {
  StitchChain,
  StitchNode,
  StitchConnection,
  RawStitchChain,
  RawStitchNode,
  RawStitchConnection,
  StitchNodeType,
} from '@/types/stitch';

// ─── Deserializers ──────────────────────────────────────────────────────────

function deserializeChain(raw: RawStitchChain): StitchChain {
  return {
    id: raw.id,
    name: raw.name,
    mappingId: raw.mapping_id ?? null,
    requestId: raw.request_id ?? null,
    folderId: raw.folder_id ?? null,
    sortOrder: raw.sort_order ?? 0,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function deserializeNode(raw: RawStitchNode): StitchNode {
  return {
    id: raw.id,
    chainId: raw.chain_id,
    type: raw.type as StitchNodeType,
    positionX: raw.position_x,
    positionY: raw.position_y,
    config: parseJsonField<Record<string, unknown>>(raw.config, {}),
    label: raw.label,
    parentNodeId: raw.parent_node_id ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function deserializeConnection(raw: RawStitchConnection): StitchConnection {
  return {
    id: raw.id,
    chainId: raw.chain_id,
    sourceNodeId: raw.source_node_id,
    sourceKey: raw.source_key,
    targetNodeId: raw.target_node_id,
    targetSlot: raw.target_slot,
    createdAt: raw.created_at,
  };
}

// ─── Chain Operations ───────────────────────────────────────────────────────

export async function loadChains(): Promise<StitchChain[]> {
  const db = await getDb();
  const rows = await db.select<RawStitchChain[]>(
    'SELECT * FROM stitch_chains ORDER BY created_at ASC',
  );
  return rows.map(deserializeChain);
}

export async function loadChainWithNodes(
  chainId: string,
): Promise<{ chain: StitchChain; nodes: StitchNode[]; connections: StitchConnection[] }> {
  const db = await getDb();
  const rawChains = await db.select<RawStitchChain[]>(
    'SELECT * FROM stitch_chains WHERE id = ?',
    [chainId],
  );
  if (rawChains.length === 0) {
    throw new Error(`Chain not found: ${chainId}`);
  }
  const rawNodes = await db.select<RawStitchNode[]>(
    'SELECT * FROM stitch_nodes WHERE chain_id = ? ORDER BY created_at ASC',
    [chainId],
  );
  const rawConns = await db.select<RawStitchConnection[]>(
    'SELECT * FROM stitch_connections WHERE chain_id = ? ORDER BY created_at ASC',
    [chainId],
  );
  return {
    chain: deserializeChain(rawChains[0]),
    nodes: rawNodes.map(deserializeNode),
    connections: rawConns.map(deserializeConnection),
  };
}

export async function insertChain(
  name: string,
  mappingId?: string | null,
  folderId?: string | null,
  requestId?: string | null,
): Promise<StitchChain> {
  const chain: StitchChain = {
    id: crypto.randomUUID(),
    name,
    mappingId: mappingId ?? null,
    requestId: requestId ?? null,
    folderId: folderId ?? null,
    sortOrder: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  await insertOne(
    'stitch_chains',
    ['id', 'name', 'mapping_id', 'request_id', 'folder_id', 'sort_order', 'created_at', 'updated_at'],
    [chain.id, chain.name, chain.mappingId, chain.requestId, chain.folderId, chain.sortOrder, chain.createdAt, chain.updatedAt],
  );
  return chain;
}

export async function updateChain(
  id: string,
  changes: { name?: string },
): Promise<void> {
  const update = buildUpdate('stitch_chains', id, changes);
  if (!update) return;
  const db = await getDb();
  await db.execute(update.sql, update.values);
}

export async function deleteChain(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM stitch_chains WHERE id = ?', [id]);
}

export async function duplicateChain(
  sourceChainId: string,
  newName: string,
): Promise<{ chain: StitchChain; nodes: StitchNode[]; connections: StitchConnection[] }> {
  const { nodes: srcNodes, connections: srcConns } = await loadChainWithNodes(sourceChainId);

  const newChain: StitchChain = {
    id: crypto.randomUUID(),
    name: newName,
    mappingId: null,
    requestId: null,
    folderId: null,
    sortOrder: 0,
    createdAt: now(),
    updatedAt: now(),
  };

  // Build ID mapping for nodes
  const nodeIdMap = new Map<string, string>();
  const newNodes: StitchNode[] = srcNodes.map((n) => {
    const newId = crypto.randomUUID();
    nodeIdMap.set(n.id, newId);
    return { ...n, id: newId, chainId: newChain.id, createdAt: now(), updatedAt: now() };
  });

  // Remap parentNodeId references
  for (const n of newNodes) {
    if (n.parentNodeId && nodeIdMap.has(n.parentNodeId)) {
      n.parentNodeId = nodeIdMap.get(n.parentNodeId)!;
    }
  }

  const newConns: StitchConnection[] = srcConns.map((c) => ({
    ...c,
    id: crypto.randomUUID(),
    chainId: newChain.id,
    sourceNodeId: nodeIdMap.get(c.sourceNodeId) ?? c.sourceNodeId,
    targetNodeId: nodeIdMap.get(c.targetNodeId) ?? c.targetNodeId,
    createdAt: now(),
  }));

  // Sequential inserts in FK-dependency order (chain → nodes → connections).
  // Not wrapped in a SAVEPOINT: tauri-plugin-sql runs each db.execute against a
  // pooled connection, so a RELEASE can land on a different connection than the
  // SAVEPOINT ("no such savepoint"). Each insert is individually atomic.
  await insertOne(
    'stitch_chains',
    ['id', 'name', 'mapping_id', 'request_id', 'folder_id', 'sort_order', 'created_at', 'updated_at'],
    [newChain.id, newChain.name, newChain.mappingId, newChain.requestId, newChain.folderId, newChain.sortOrder, newChain.createdAt, newChain.updatedAt],
  );
  for (const n of newNodes) {
    await insertOne(
      'stitch_nodes',
      ['id', 'chain_id', 'type', 'position_x', 'position_y', 'config', 'label', 'parent_node_id', 'created_at', 'updated_at'],
      [n.id, n.chainId, n.type, n.positionX, n.positionY, JSON.stringify(n.config), n.label, n.parentNodeId, n.createdAt, n.updatedAt],
    );
  }
  for (const c of newConns) {
    await insertOne(
      'stitch_connections',
      ['id', 'chain_id', 'source_node_id', 'source_key', 'target_node_id', 'target_slot', 'created_at'],
      [c.id, c.chainId, c.sourceNodeId, c.sourceKey, c.targetNodeId, c.targetSlot, c.createdAt],
    );
  }

  return { chain: newChain, nodes: newNodes, connections: newConns };
}

// ─── Node Operations ────────────────────────────────────────────────────────

export async function insertNode(
  node: Omit<StitchNode, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<StitchNode> {
  const full: StitchNode = {
    ...node,
    id: crypto.randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  await insertOne(
    'stitch_nodes',
    ['id', 'chain_id', 'type', 'position_x', 'position_y', 'config', 'label', 'parent_node_id', 'created_at', 'updated_at'],
    [full.id, full.chainId, full.type, full.positionX, full.positionY, JSON.stringify(full.config), full.label, full.parentNodeId, full.createdAt, full.updatedAt],
  );
  return full;
}

export async function updateNode(
  id: string,
  changes: { positionX?: number; positionY?: number; config?: Record<string, unknown>; label?: string | null; parentNodeId?: string | null },
): Promise<void> {
  const mapped: Record<string, unknown> = {};
  if (changes.positionX !== undefined) mapped.position_x = changes.positionX;
  if (changes.positionY !== undefined) mapped.position_y = changes.positionY;
  if (changes.config !== undefined) mapped.config = JSON.stringify(changes.config);
  if (changes.label !== undefined) mapped.label = changes.label;
  if (changes.parentNodeId !== undefined) mapped.parent_node_id = changes.parentNodeId;

  const update = buildUpdate('stitch_nodes', id, mapped);
  if (!update) return;
  const db = await getDb();
  await db.execute(update.sql, update.values);
}

export async function deleteNode(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM stitch_nodes WHERE id = ?', [id]);
}

// ─── Connection Operations ──────────────────────────────────────────────────

export async function insertConnection(conn: StitchConnection): Promise<void> {
  await insertOne(
    'stitch_connections',
    ['id', 'chain_id', 'source_node_id', 'source_key', 'target_node_id', 'target_slot', 'created_at'],
    [conn.id, conn.chainId, conn.sourceNodeId, conn.sourceKey, conn.targetNodeId, conn.targetSlot, conn.createdAt],
  );
}

export async function deleteConnection(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM stitch_connections WHERE id = ?', [id]);
}

export async function updateConnection(
  id: string,
  changes: { targetSlot?: string },
): Promise<void> {
  // stitch_connections has no updated_at column, so we can't use buildUpdate
  // (which auto-appends updated_at). Inline the SQL instead.
  const sets: string[] = [];
  const values: unknown[] = [];
  if (changes.targetSlot !== undefined) { sets.push('target_slot = ?'); values.push(changes.targetSlot); }
  if (sets.length === 0) return;
  values.push(id);
  const db = await getDb();
  await db.execute(`UPDATE stitch_connections SET ${sets.join(', ')} WHERE id = ?`, values);
}


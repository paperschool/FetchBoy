import type { StitchNode, StitchConnection } from '@/types/stitch';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 90;
const GAP_X = 40;
const GAP_Y = 40;
const MAPPING_PADDING_X = 30;
const MAPPING_PADDING_TOP = 50;
const MAX_COLS = 3;

/**
 * Compute positions for child nodes inside a mapping container.
 * Entry node pinned top-left, Exit node pinned bottom-right,
 * middle nodes arranged in a grid flow (topological order, wrapping rows).
 */
export function computeMappingChildPositions(
  mappingNode: StitchNode,
  children: StitchNode[],
  connections: StitchConnection[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (children.length === 0) return positions;

  const entryNode = children.find((n) => n.type === 'mapping-entry');
  const exitNode = children.find((n) => n.type === 'mapping-exit');
  const middleNodes = children.filter((n) => n.type !== 'mapping-entry' && n.type !== 'mapping-exit');

  // Topological sort of middle nodes
  const childIds = new Set(middleNodes.map((n) => n.id));
  const childConns = connections.filter(
    (c) => childIds.has(c.sourceNodeId) && childIds.has(c.targetNodeId),
  );

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const c of middleNodes) {
    inDegree.set(c.id, 0);
    adj.set(c.id, []);
  }
  for (const conn of childConns) {
    adj.get(conn.sourceNodeId)?.push(conn.targetNodeId);
    inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
  }
  const sorted: StitchNode[] = [];
  const queue = middleNodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const next of adj.get(node.id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) {
        const nextNode = middleNodes.find((n) => n.id === next);
        if (nextNode) queue.push(nextNode);
      }
    }
  }
  for (const c of middleNodes) {
    if (!sorted.some((s) => s.id === c.id)) sorted.push(c);
  }

  const startX = mappingNode.positionX + MAPPING_PADDING_X;
  const startY = mappingNode.positionY + MAPPING_PADDING_TOP;

  // Entry on the first row, left
  if (entryNode) {
    positions.set(entryNode.id, { x: startX, y: startY });
  }

  // Middle nodes in a grid flow after entry
  // Determine columns: entry takes first slot if present
  const allOrdered: StitchNode[] = [];
  if (entryNode) allOrdered.push(entryNode);
  allOrdered.push(...sorted);

  // Layout all ordered nodes (entry + middle) in rows
  for (let i = 0; i < allOrdered.length; i++) {
    const col = i % MAX_COLS;
    const row = Math.floor(i / MAX_COLS);
    positions.set(allOrdered[i].id, {
      x: startX + col * (NODE_WIDTH + GAP_X),
      y: startY + row * (NODE_HEIGHT + GAP_Y),
    });
  }

  // Exit after the last row
  if (exitNode) {
    const totalItems = allOrdered.length;
    const lastRow = Math.floor((totalItems - 1) / MAX_COLS);
    const exitRow = lastRow + 1;
    positions.set(exitNode.id, {
      x: startX,
      y: startY + exitRow * (NODE_HEIGHT + GAP_Y),
    });
  }

  return positions;
}

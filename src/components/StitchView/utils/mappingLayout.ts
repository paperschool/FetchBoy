import type { StitchNode, StitchConnection } from '@/types/stitch';

const NODE_WIDTH = 180;
const GAP_X = 30;
const MAPPING_PADDING_X = 30;
const MAPPING_PADDING_TOP = 50;

/**
 * Compute positions for child nodes inside a mapping container.
 * Entry node pinned to the left, Exit node pinned to the right,
 * user-added nodes arranged between them in topological order.
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

  // Entry on the left
  if (entryNode) {
    positions.set(entryNode.id, { x: startX, y: startY });
  }

  // Middle nodes after entry
  const offsetStart = entryNode ? 1 : 0;
  for (let i = 0; i < sorted.length; i++) {
    positions.set(sorted[i].id, {
      x: startX + (offsetStart + i) * (NODE_WIDTH + GAP_X),
      y: startY,
    });
  }

  // Exit at the end
  if (exitNode) {
    const exitIdx = offsetStart + sorted.length;
    positions.set(exitNode.id, {
      x: startX + exitIdx * (NODE_WIDTH + GAP_X),
      y: startY,
    });
  }

  return positions;
}

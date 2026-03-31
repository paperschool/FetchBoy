import type { StitchNode, StitchConnection } from '@/types/stitch';

const NODE_WIDTH = 180;
const GAP_X = 30;
const LOOP_PADDING_X = 30;
const LOOP_PADDING_TOP = 50; // below the loop header

/**
 * Compute balanced positions for child nodes inside a loop.
 * Arranges nodes left-to-right in topological order.
 * Returns a map of nodeId → { x, y } in absolute canvas coordinates.
 */
export function computeLoopChildPositions(
  loopNode: StitchNode,
  children: StitchNode[],
  connections: StitchConnection[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (children.length === 0) return positions;

  // Simple topological sort of children
  const childIds = new Set(children.map((n) => n.id));
  const childConns = connections.filter(
    (c) => childIds.has(c.sourceNodeId) && childIds.has(c.targetNodeId),
  );

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const c of children) {
    inDegree.set(c.id, 0);
    adj.set(c.id, []);
  }
  for (const conn of childConns) {
    adj.get(conn.sourceNodeId)?.push(conn.targetNodeId);
    inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
  }

  const sorted: StitchNode[] = [];
  const queue = children.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const next of adj.get(node.id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) {
        const nextNode = children.find((n) => n.id === next);
        if (nextNode) queue.push(nextNode);
      }
    }
  }
  // Add any remaining (cycle or disconnected) nodes
  for (const c of children) {
    if (!sorted.some((s) => s.id === c.id)) sorted.push(c);
  }

  // Arrange left-to-right
  const startX = loopNode.positionX + LOOP_PADDING_X;
  const startY = loopNode.positionY + LOOP_PADDING_TOP;

  for (let i = 0; i < sorted.length; i++) {
    positions.set(sorted[i].id, {
      x: startX + i * (NODE_WIDTH + GAP_X),
      y: startY,
    });
  }

  return positions;
}

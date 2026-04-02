import type { StitchNode, StitchConnection } from '@/types/stitch';

export function topologicalSort(
  nodes: StitchNode[],
  connections: StitchConnection[],
): StitchNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const conn of connections) {
    adjacency.get(conn.sourceNodeId)?.push(conn.targetNodeId);
    inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  // Stable ordering: sort zero-degree nodes by original position
  queue.sort((a, b) => {
    const na = nodeMap.get(a)!;
    const nb = nodeMap.get(b)!;
    return na.positionY - nb.positionY || na.positionX - nb.positionX;
  });

  const sorted: StitchNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(nodeMap.get(id)!);

    const neighbors = adjacency.get(id) ?? [];
    const nextBatch: string[] = [];
    for (const neighbor of neighbors) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) nextBatch.push(neighbor);
    }
    // Stable ordering within each BFS level
    nextBatch.sort((a, b) => {
      const na = nodeMap.get(a)!;
      const nb = nodeMap.get(b)!;
      return na.positionY - nb.positionY || na.positionX - nb.positionX;
    });
    queue.push(...nextBatch);
  }

  if (sorted.length !== nodes.length) {
    const cycleNodeIds = nodes
      .filter((n) => !sorted.some((s) => s.id === n.id))
      .map((n) => n.label ?? n.type);
    throw new Error(`Cycle detected involving nodes: ${cycleNodeIds.join(', ')}`);
  }

  return sorted;
}

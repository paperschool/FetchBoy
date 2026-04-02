import type { StitchNode, StitchConnection } from '@/types/stitch';

export function groupByDepth(
  sorted: StitchNode[],
  connections: StitchConnection[],
): StitchNode[][] {
  const depth = new Map<string, number>();

  for (const node of sorted) {
    const incoming = connections.filter((c) => c.targetNodeId === node.id);
    if (incoming.length === 0) {
      depth.set(node.id, 0);
    } else {
      let maxParentDepth = 0;
      for (const conn of incoming) {
        maxParentDepth = Math.max(maxParentDepth, depth.get(conn.sourceNodeId) ?? 0);
      }
      depth.set(node.id, maxParentDepth + 1);
    }
  }

  const groups = new Map<number, StitchNode[]>();
  for (const node of sorted) {
    const d = depth.get(node.id) ?? 0;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(node);
  }

  const maxDepth = Math.max(...groups.keys(), 0);
  const result: StitchNode[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    result.push(groups.get(d) ?? []);
  }
  return result;
}

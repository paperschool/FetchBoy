import type { StitchConnection } from '@/types/stitch';

/**
 * Resolve the input shape for a node by finding all incoming connections
 * and collecting their sourceKey values. Connections with null sourceKey
 * (single-port nodes like JSON Object / JS Snippet) are included as a
 * placeholder so the node knows it has an input.
 */
export function resolveInputShape(
  nodeId: string,
  connections: StitchConnection[],
): string[] {
  const keys: string[] = [];
  for (const c of connections) {
    if (c.targetNodeId !== nodeId) continue;
    if (c.sourceKey !== null) {
      keys.push(c.sourceKey);
    }
    // null sourceKey connections are handled at runtime by spreading all source outputs
  }
  return keys;
}

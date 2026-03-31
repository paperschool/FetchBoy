import type { StitchConnection } from '@/types/stitch';

/**
 * Resolve the input shape for a node by finding all incoming connections
 * and collecting their sourceKey values.
 */
export function resolveInputShape(
  nodeId: string,
  connections: StitchConnection[],
): string[] {
  return connections
    .filter((c) => c.targetNodeId === nodeId && c.sourceKey !== null)
    .map((c) => c.sourceKey as string);
}

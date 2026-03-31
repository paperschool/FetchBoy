import type { StitchConnection } from '@/types/stitch';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateConnection(
  sourceNodeId: string,
  sourceKey: string | null,
  targetNodeId: string,
  connections: StitchConnection[],
): ValidationResult {
  // Self-connection
  if (sourceNodeId === targetNodeId) {
    return { valid: false, reason: 'Cannot connect a node to itself' };
  }

  // Duplicate connection (same source port → same target)
  const duplicate = connections.find(
    (c) => c.sourceNodeId === sourceNodeId && c.sourceKey === sourceKey && c.targetNodeId === targetNodeId,
  );
  if (duplicate) {
    return { valid: false, reason: 'Connection already exists' };
  }

  // Cycle detection: DFS from targetNodeId following existing connections
  if (wouldCreateCycle(sourceNodeId, targetNodeId, connections)) {
    return { valid: false, reason: 'Would create a cycle' };
  }

  return { valid: true };
}

/** DFS: can we reach `sourceNodeId` by following connections from `targetNodeId`? */
function wouldCreateCycle(
  sourceNodeId: string,
  targetNodeId: string,
  connections: StitchConnection[],
): boolean {
  const visited = new Set<string>();
  const stack = [targetNodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceNodeId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    // Follow outgoing connections from current node
    for (const conn of connections) {
      if (conn.sourceNodeId === current) {
        stack.push(conn.targetNodeId);
      }
    }
  }

  return false;
}

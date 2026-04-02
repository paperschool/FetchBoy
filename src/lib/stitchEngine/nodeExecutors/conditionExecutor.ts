import type { StitchNode, StitchConnection } from '@/types/stitch';

export function executeConditionNode(
  node: StitchNode,
  input: Record<string, unknown>,
): { result: boolean; output: Record<string, unknown> } {
  const config = node.config as { expression?: string };
  const expression = config.expression ?? 'true';

  try {
    const fn = new Function('input', `return (${expression})`);
    const result = Boolean(fn(input));
    return { result, output: { ...input, _condition: result } };
  } catch (err) {
    throw new Error(`Condition node "${node.label ?? node.id}": ${(err as Error).message}`);
  }
}

/**
 * Compute the set of node IDs that should be skipped based on condition results.
 * For a condition node with result=true, skip all nodes exclusively reachable
 * from the 'false' port (and vice versa). Nodes reachable from BOTH branches
 * (convergence points) are NOT skipped.
 */
export function computeSkippedNodes(
  conditionNodeId: string,
  conditionResult: boolean,
  connections: StitchConnection[],
  allNodeIds: Set<string>,
): Set<string> {
  const skippedPort = conditionResult ? 'false' : 'true';
  const activePort = conditionResult ? 'true' : 'false';

  const skippedRoots = connections
    .filter((c) => c.sourceNodeId === conditionNodeId && c.sourceKey === skippedPort)
    .map((c) => c.targetNodeId);
  const activeRoots = connections
    .filter((c) => c.sourceNodeId === conditionNodeId && c.sourceKey === activePort)
    .map((c) => c.targetNodeId);

  const reachable = (roots: string[]): Set<string> => {
    const visited = new Set<string>();
    const stack = [...roots];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id) || !allNodeIds.has(id)) continue;
      visited.add(id);
      for (const conn of connections) {
        if (conn.sourceNodeId === id) stack.push(conn.targetNodeId);
      }
    }
    return visited;
  };

  const skippedReachable = reachable(skippedRoots);
  const activeReachable = reachable(activeRoots);

  const skipped = new Set<string>();
  for (const id of skippedReachable) {
    if (!activeReachable.has(id)) {
      skipped.add(id);
    }
  }

  return skipped;
}

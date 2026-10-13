import type { StitchNode, StitchConnection } from '@/types/stitch';

/**
 * Returns `targetNodeId` plus every node that transitively feeds into it
 * (BFS backward through connections). Used to slice out just the subset of a
 * mapping chain that Entry depends on, so the request-side pause only runs
 * the nodes it actually needs rather than the whole entry+response+exit graph.
 */
export function getUpstreamNodes(
    targetNodeId: string,
    nodes: StitchNode[],
    connections: StitchConnection[],
): StitchNode[] {
    const visited = new Set<string>();
    const stack = [targetNodeId];

    while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        for (const conn of connections) {
            if (conn.targetNodeId === current) stack.push(conn.sourceNodeId);
        }
    }

    return nodes.filter((n) => visited.has(n.id));
}

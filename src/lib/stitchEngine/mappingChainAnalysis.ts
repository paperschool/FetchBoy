import type { StitchNode, StitchConnection } from '@/types/stitch';

const REQUEST_CANONICAL_KEYS = ['method', 'headers', 'body', 'url'] as const;
const RESPONSE_CANONICAL_KEYS = ['status', 'headers', 'body', 'cookies'] as const;

export interface MappingChainRequirements {
    needsRequestChain: boolean;
    needsResponseChain: boolean;
}

/**
 * Pure analysis of a mapping chain's Entry/Response/Exit wiring, used to decide
 * which proxy-side pause phases (request-side / response-side) are actually
 * needed — so an untouched chain doesn't pay the pause latency for a segment
 * it never customizes.
 *
 * Response is where the (possibly request-modified) call is actually fired:
 * its inputs are the outbound request shape (default-wired 1:1 from Entry),
 * its outputs are the real reply (feeding Exit). Both checks are the same
 * shape — "is this edge an untouched 1:1 passthrough?" — just one hop apart.
 *
 * v1 heuristic: anything that isn't an exact 1:1 passthrough is conservatively
 * classified as "needs pause" (safe false-positive direction, never a false
 * negative that would silently skip a real transform).
 */
export function analyzeMappingChainRequirements(
    nodes: StitchNode[],
    connections: StitchConnection[],
): MappingChainRequirements {
    const entryNode = nodes.find((n) => n.type === 'mapping-entry');
    const responseNode = nodes.find((n) => n.type === 'mapping-response');
    const exitNode = nodes.find((n) => n.type === 'mapping-exit');

    return {
        needsRequestChain: !isDefaultPassthroughWiring(entryNode, responseNode, connections, REQUEST_CANONICAL_KEYS),
        needsResponseChain: !isDefaultPassthroughWiring(responseNode, exitNode, connections, RESPONSE_CANONICAL_KEYS),
    };
}

/** True only if every connection into `targetNode` is an unmodified 1:1 passthrough from `sourceNode`. */
function isDefaultPassthroughWiring(
    sourceNode: StitchNode | undefined,
    targetNode: StitchNode | undefined,
    connections: StitchConnection[],
    canonicalKeys: readonly string[],
): boolean {
    if (!sourceNode || !targetNode) return false;
    const incoming = connections.filter((c) => c.targetNodeId === targetNode.id);
    if (incoming.length === 0) return false;
    return incoming.every(
        (c) =>
            c.sourceNodeId === sourceNode.id &&
            c.sourceKey != null &&
            (c.targetSlot === c.sourceKey || c.targetSlot === null) &&
            canonicalKeys.includes(c.sourceKey),
    );
}

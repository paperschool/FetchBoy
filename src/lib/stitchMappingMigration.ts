import type { StitchNode, StitchConnection } from '@/types/stitch';
import { DEFAULT_MAPPING_RESPONSE_CONFIG } from '@/types/stitch';
import { insertNode, insertConnection, deleteConnection } from '@/lib/stitch';
import { analyzeMappingChainRequirements } from '@/lib/stitchEngine/mappingChainAnalysis';

const EXIT_KEYS = ['status', 'headers', 'body', 'cookies'] as const;
// Response is where the (possibly request-modified) call is actually fired —
// these are the fields it needs wired from Entry by default so an untouched
// chain still forwards the real request unchanged.
const ENTRY_TO_RESPONSE_DEFAULT_KEYS = ['method', 'headers', 'body', 'url'] as const;

function makeConnection(chainId: string, overrides: Partial<StitchConnection> & Pick<StitchConnection, 'sourceNodeId' | 'targetNodeId'>): StitchConnection {
    return {
        id: crypto.randomUUID(),
        chainId,
        sourceKey: null,
        targetSlot: null,
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Upgrades a mapping chain in place, in the database, so it matches the current
 * entry → response → exit shape:
 *  - expands an old single entry→exit connection into 4 keyed connections
 *  - inserts the Response node (rewiring any direct entry→exit connections
 *    through it) if the chain predates it — entry no longer carries
 *    response-shaped data, so those connections would otherwise silently feed
 *    exit the wrong (request) data instead of the real response.
 *  - wires Entry's method/headers/body/url into Response by default wherever
 *    those ports aren't already customized, since Response is what actually
 *    fires the (possibly modified) request.
 *
 * No-ops (and returns the input unchanged) once a chain is already up to date.
 * Safe to call every time a chain is loaded, including from the proxy's live
 * chain-execution path, so legacy mappings self-heal the first time they run
 * rather than only when a user happens to open them in the Stitch view.
 *
 * When `mappingId` is supplied, also recomputes and persists this chain's
 * `needs_request_chain`/`needs_response_chain` flags if they've drifted from
 * what's stored — so legacy mappings self-heal their pause-gating flags the
 * same way they self-heal their wiring.
 */
export async function ensureMappingChainUpToDate(
    chainId: string,
    nodes: StitchNode[],
    connections: StitchConnection[],
    mappingId?: string | null,
): Promise<{ nodes: StitchNode[]; connections: StitchConnection[] }> {
    const entryNode = nodes.find((n) => n.type === 'mapping-entry');
    const exitNode = nodes.find((n) => n.type === 'mapping-exit');
    if (!entryNode || !exitNode) return { nodes, connections };

    let workingConnections = connections;
    let workingNodes = nodes;

    const entryToExit = workingConnections.filter(
        (c) => c.sourceNodeId === entryNode.id && c.targetNodeId === exitNode.id,
    );
    const hasOldSingleConnection = entryToExit.length === 1 && entryToExit[0].sourceKey === null;
    if (hasOldSingleConnection) {
        await deleteConnection(entryToExit[0].id);
        workingConnections = workingConnections.filter((c) => c.id !== entryToExit[0].id);
        for (const key of EXIT_KEYS) {
            const conn = makeConnection(chainId, { sourceNodeId: entryNode.id, sourceKey: key, targetNodeId: exitNode.id, targetSlot: key });
            await insertConnection(conn);
            workingConnections = [...workingConnections, conn];
        }
    }

    const responseNode = nodes.find((n) => n.type === 'mapping-response');
    if (responseNode) {
        workingConnections = await ensureDefaultEntryToResponseWiring(chainId, entryNode.id, responseNode.id, workingConnections);
    } else {
        const newResponseNode = await insertNode({
            chainId,
            type: 'mapping-response',
            positionX: entryNode.positionX,
            positionY: (entryNode.positionY + exitNode.positionY) / 2,
            config: { ...DEFAULT_MAPPING_RESPONSE_CONFIG },
            label: 'Response',
            parentNodeId: entryNode.parentNodeId,
        });

        const directToExit = workingConnections.filter(
            (c) => c.sourceNodeId === entryNode.id && c.targetNodeId === exitNode.id && c.sourceKey,
        );
        for (const conn of directToExit) {
            await deleteConnection(conn.id);
            workingConnections = workingConnections.filter((c) => c.id !== conn.id);
            const rewired = makeConnection(chainId, {
                sourceNodeId: newResponseNode.id,
                sourceKey: conn.sourceKey,
                targetNodeId: exitNode.id,
                targetSlot: conn.targetSlot ?? conn.sourceKey,
            });
            await insertConnection(rewired);
            workingConnections = [...workingConnections, rewired];
        }

        workingNodes = [...nodes, newResponseNode];
        workingConnections = await ensureDefaultEntryToResponseWiring(chainId, entryNode.id, newResponseNode.id, workingConnections);
    }

    await syncMappingChainFlags(mappingId, workingNodes, workingConnections);

    return { nodes: workingNodes, connections: workingConnections };
}

/**
 * Recomputes `needs_request_chain`/`needs_response_chain` for the mapping this
 * chain is bound to, and persists them (DB + store + proxy sync) only if
 * they've actually changed. No-op if `mappingId` is nullish or unknown.
 */
export async function syncMappingChainFlags(
    mappingId: string | null | undefined,
    nodes: StitchNode[],
    connections: StitchConnection[],
): Promise<void> {
    if (!mappingId) return;
    const { useMappingsStore } = await import('@/stores/mappingsStore');
    const mapping = useMappingsStore.getState().mappings.find((m) => m.id === mappingId);
    if (!mapping) return;

    const { needsRequestChain, needsResponseChain } = analyzeMappingChainRequirements(nodes, connections);
    if (mapping.needs_request_chain === needsRequestChain && mapping.needs_response_chain === needsResponseChain) {
        return;
    }

    await useMappingsStore.getState().updateMapping(mappingId, {
        needs_request_chain: needsRequestChain,
        needs_response_chain: needsResponseChain,
    });
}

async function ensureDefaultEntryToResponseWiring(
    chainId: string,
    entryNodeId: string,
    responseNodeId: string,
    connections: StitchConnection[],
): Promise<StitchConnection[]> {
    let working = connections;
    for (const key of ENTRY_TO_RESPONSE_DEFAULT_KEYS) {
        // Skip if this port already has any incoming wiring — respect existing
        // customization rather than clobbering it with the default passthrough.
        const slotOccupied = working.some((c) => c.targetNodeId === responseNodeId && (c.targetSlot ?? c.sourceKey) === key);
        if (slotOccupied) continue;
        const conn = makeConnection(chainId, { sourceNodeId: entryNodeId, sourceKey: key, targetNodeId: responseNodeId, targetSlot: key });
        await insertConnection(conn);
        working = [...working, conn];
    }
    return working;
}

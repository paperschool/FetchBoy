import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StitchNode, StitchConnection } from '@/types/stitch';

const insertNodeMock = vi.fn();
const insertConnectionMock = vi.fn();
const deleteConnectionMock = vi.fn();
vi.mock('@/lib/stitch', () => ({
    insertNode: (...args: unknown[]) => insertNodeMock(...args),
    insertConnection: (...args: unknown[]) => insertConnectionMock(...args),
    deleteConnection: (...args: unknown[]) => deleteConnectionMock(...args),
}));

const updateMappingMock = vi.fn();
let mockMappings: Array<{ id: string; needs_request_chain: boolean; needs_response_chain: boolean }> = [];
vi.mock('@/stores/mappingsStore', () => ({
    useMappingsStore: {
        getState: () => ({
            mappings: mockMappings,
            updateMapping: (...args: unknown[]) => updateMappingMock(...args),
        }),
    },
}));

import { ensureMappingChainUpToDate, syncMappingChainFlags } from './stitchMappingMigration';

function makeNode(overrides: Partial<StitchNode> & { id: string; type: StitchNode['type'] }): StitchNode {
    return {
        chainId: 'chain-1',
        positionX: 0,
        positionY: 0,
        config: {},
        label: null,
        parentNodeId: null,
        createdAt: '',
        updatedAt: '',
        ...overrides,
    };
}

function makeConn(overrides: Partial<StitchConnection> & { sourceNodeId: string; targetNodeId: string }): StitchConnection {
    return {
        id: `${overrides.sourceNodeId}-${overrides.targetNodeId}-${overrides.sourceKey ?? 'single'}`,
        chainId: 'chain-1',
        sourceKey: null,
        targetSlot: null,
        createdAt: '',
        ...overrides,
    };
}

describe('ensureMappingChainUpToDate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMappings = [];
        insertNodeMock.mockImplementation(async (node) => ({ ...node, id: 'response-1', createdAt: '', updatedAt: '' }));
    });

    it('no-ops when entry or exit is missing', async () => {
        const nodes = [makeNode({ id: 'e', type: 'mapping-entry' })];
        const result = await ensureMappingChainUpToDate('chain-1', nodes, []);
        expect(result).toEqual({ nodes, connections: [] });
        expect(insertNodeMock).not.toHaveBeenCalled();
    });

    it('no-ops when the chain is already up to date', async () => {
        const nodes = [
            makeNode({ id: 'entry', type: 'mapping-entry' }),
            makeNode({ id: 'response', type: 'mapping-response' }),
            makeNode({ id: 'exit', type: 'mapping-exit' }),
        ];
        const connections = [
            ...['method', 'headers', 'body', 'url'].map((key) =>
                makeConn({ sourceNodeId: 'entry', targetNodeId: 'response', sourceKey: key, targetSlot: key }),
            ),
            makeConn({ sourceNodeId: 'response', targetNodeId: 'exit', sourceKey: 'status', targetSlot: 'status' }),
        ];
        const result = await ensureMappingChainUpToDate('chain-1', nodes, connections);
        expect(result).toEqual({ nodes, connections });
        expect(insertNodeMock).not.toHaveBeenCalled();
        expect(insertConnectionMock).not.toHaveBeenCalled();
    });

    it('expands an old single entry\u2192exit connection into 4 keyed connections', async () => {
        const nodes = [
            makeNode({ id: 'entry', type: 'mapping-entry' }),
            makeNode({ id: 'response', type: 'mapping-response' }),
            makeNode({ id: 'exit', type: 'mapping-exit' }),
        ];
        const oldSingle = makeConn({ sourceNodeId: 'entry', targetNodeId: 'exit', sourceKey: null });
        const result = await ensureMappingChainUpToDate('chain-1', nodes, [oldSingle]);

        expect(deleteConnectionMock).toHaveBeenCalledWith(oldSingle.id);
        // 4 for the entry→exit expansion, plus 4 for the entry→response default wiring
        expect(insertConnectionMock).toHaveBeenCalledTimes(8);
        const exitConns = result.connections.filter((c) => c.targetNodeId === 'exit');
        expect(exitConns.map((c) => c.sourceKey).sort()).toEqual(['body', 'cookies', 'headers', 'status']);
        expect(exitConns.every((c) => c.sourceNodeId === 'entry')).toBe(true);
        const responseConns = result.connections.filter((c) => c.targetNodeId === 'response');
        expect(responseConns.map((c) => c.sourceKey).sort()).toEqual(['body', 'headers', 'method', 'url']);
        expect(responseConns.every((c) => c.sourceNodeId === 'entry')).toBe(true);
    });

    it('inserts the Response node and rewires direct entry\u2192exit connections through it', async () => {
        const nodes = [
            makeNode({ id: 'entry', type: 'mapping-entry' }),
            makeNode({ id: 'exit', type: 'mapping-exit' }),
        ];
        const directConns = [
            makeConn({ sourceNodeId: 'entry', targetNodeId: 'exit', sourceKey: 'status', targetSlot: 'status' }),
            makeConn({ sourceNodeId: 'entry', targetNodeId: 'exit', sourceKey: 'body', targetSlot: 'body' }),
        ];

        const result = await ensureMappingChainUpToDate('chain-1', nodes, directConns);

        expect(insertNodeMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'mapping-response', chainId: 'chain-1' }));
        expect(result.nodes.some((n) => n.type === 'mapping-response')).toBe(true);
        expect(deleteConnectionMock).toHaveBeenCalledTimes(2);
        const exitConns = result.connections.filter((c) => c.targetNodeId === 'exit');
        expect(exitConns.every((c) => c.sourceNodeId === 'response-1')).toBe(true);
        expect(exitConns.map((c) => c.sourceKey).sort()).toEqual(['body', 'status']);
        // The new Response node also gets the default entry→response wiring.
        const responseConns = result.connections.filter((c) => c.targetNodeId === 'response-1');
        expect(responseConns.map((c) => c.sourceKey).sort()).toEqual(['body', 'headers', 'method', 'url']);
        expect(responseConns.every((c) => c.sourceNodeId === 'entry')).toBe(true);
    });

    describe('flag self-heal (mappingId supplied)', () => {
        const scaffoldNodes = (): StitchNode[] => [
            makeNode({ id: 'entry', type: 'mapping-entry' }),
            makeNode({ id: 'response', type: 'mapping-response' }),
            makeNode({ id: 'exit', type: 'mapping-exit' }),
        ];
        const defaultConnections = (): StitchConnection[] => [
            makeConn({ sourceNodeId: 'response', targetNodeId: 'exit', sourceKey: 'status', targetSlot: 'status' }),
        ];

        it('does nothing when mappingId is not supplied', async () => {
            await ensureMappingChainUpToDate('chain-1', scaffoldNodes(), defaultConnections());
            expect(updateMappingMock).not.toHaveBeenCalled();
        });

        it('does nothing when the mapping already has the correct flags', async () => {
            mockMappings = [{ id: 'm1', needs_request_chain: false, needs_response_chain: false }];
            await ensureMappingChainUpToDate('chain-1', scaffoldNodes(), defaultConnections(), 'm1');
            expect(updateMappingMock).not.toHaveBeenCalled();
        });

        it('persists recomputed flags when they differ from stored values', async () => {
            mockMappings = [{ id: 'm1', needs_request_chain: false, needs_response_chain: true }];
            await ensureMappingChainUpToDate('chain-1', scaffoldNodes(), defaultConnections(), 'm1');
            expect(updateMappingMock).toHaveBeenCalledWith('m1', {
                needs_request_chain: false,
                needs_response_chain: false,
            });
        });

        it('no-ops when mappingId does not match any known mapping', async () => {
            mockMappings = [{ id: 'other', needs_request_chain: false, needs_response_chain: true }];
            await ensureMappingChainUpToDate('chain-1', scaffoldNodes(), defaultConnections(), 'm1');
            expect(updateMappingMock).not.toHaveBeenCalled();
        });
    });
});

describe('syncMappingChainFlags', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMappings = [];
    });

    it('is a no-op for a nullish mappingId', async () => {
        await syncMappingChainFlags(null, [], []);
        await syncMappingChainFlags(undefined, [], []);
        expect(updateMappingMock).not.toHaveBeenCalled();
    });
});

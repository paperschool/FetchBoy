import { describe, it, expect } from 'vitest';
import type { StitchNode, StitchConnection } from '@/types/stitch';
import { analyzeMappingChainRequirements } from './mappingChainAnalysis';

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
        id: `${overrides.sourceNodeId}-${overrides.targetNodeId}-${overrides.sourceKey ?? 'single'}-${overrides.targetSlot ?? 'input'}`,
        chainId: 'chain-1',
        sourceKey: null,
        targetSlot: null,
        createdAt: '',
        ...overrides,
    };
}

const REQUEST_KEYS = ['method', 'headers', 'body', 'url'] as const;
const RESPONSE_KEYS = ['status', 'headers', 'body', 'cookies'] as const;

function scaffoldNodes(): StitchNode[] {
    return [
        makeNode({ id: 'entry', type: 'mapping-entry' }),
        makeNode({ id: 'response', type: 'mapping-response' }),
        makeNode({ id: 'exit', type: 'mapping-exit' }),
    ];
}

function defaultEntryToResponseConnections(): StitchConnection[] {
    return REQUEST_KEYS.map((key) => makeConn({ sourceNodeId: 'entry', targetNodeId: 'response', sourceKey: key, targetSlot: key }));
}

function defaultResponseToExitConnections(): StitchConnection[] {
    return RESPONSE_KEYS.map((key) => makeConn({ sourceNodeId: 'response', targetNodeId: 'exit', sourceKey: key, targetSlot: key }));
}

function defaultConnections(): StitchConnection[] {
    return [...defaultEntryToResponseConnections(), ...defaultResponseToExitConnections()];
}

describe('analyzeMappingChainRequirements', () => {
    it('fresh scaffold with default Entry→Response and Response→Exit passthroughs needs neither phase', () => {
        const result = analyzeMappingChainRequirements(scaffoldNodes(), defaultConnections());
        expect(result).toEqual({ needsRequestChain: false, needsResponseChain: false });
    });

    it('a transform wired between Entry and Response needs the request chain only', () => {
        const nodes = [...scaffoldNodes(), makeNode({ id: 'js', type: 'js-snippet' })];
        const connections = [
            makeConn({ sourceNodeId: 'entry', targetNodeId: 'js', sourceKey: 'url' }),
            makeConn({ sourceNodeId: 'js', targetNodeId: 'response', targetSlot: 'url' }),
            makeConn({ sourceNodeId: 'entry', targetNodeId: 'response', sourceKey: 'method', targetSlot: 'method' }),
            makeConn({ sourceNodeId: 'entry', targetNodeId: 'response', sourceKey: 'headers', targetSlot: 'headers' }),
            makeConn({ sourceNodeId: 'entry', targetNodeId: 'response', sourceKey: 'body', targetSlot: 'body' }),
            ...defaultResponseToExitConnections(),
        ];
        const result = analyzeMappingChainRequirements(nodes, connections);
        expect(result).toEqual({ needsRequestChain: true, needsResponseChain: false });
    });

    it('a transform wired between Response and Exit needs the response chain only', () => {
        const nodes = [...scaffoldNodes(), makeNode({ id: 'js', type: 'js-snippet' })];
        const connections = [
            ...defaultEntryToResponseConnections(),
            makeConn({ sourceNodeId: 'response', targetNodeId: 'js', sourceKey: 'body' }),
            makeConn({ sourceNodeId: 'js', targetNodeId: 'exit', targetSlot: 'body' }),
            makeConn({ sourceNodeId: 'response', targetNodeId: 'exit', sourceKey: 'status', targetSlot: 'status' }),
        ];
        const result = analyzeMappingChainRequirements(nodes, connections);
        expect(result).toEqual({ needsRequestChain: false, needsResponseChain: true });
    });

    it('a subset of the canonical keys wired directly still counts as default on both edges', () => {
        const nodes = scaffoldNodes();
        const connections = [
            makeConn({ sourceNodeId: 'entry', targetNodeId: 'response', sourceKey: 'method', targetSlot: 'method' }),
            makeConn({ sourceNodeId: 'response', targetNodeId: 'exit', sourceKey: 'status', targetSlot: 'status' }),
        ];
        const result = analyzeMappingChainRequirements(nodes, connections);
        expect(result).toEqual({ needsRequestChain: false, needsResponseChain: false });
    });

    it('nothing wired at all needs both phases (conservative)', () => {
        const result = analyzeMappingChainRequirements(scaffoldNodes(), []);
        expect(result).toEqual({ needsRequestChain: true, needsResponseChain: true });
    });

    it('conservatively needs both phases when Entry/Response/Exit nodes are absent entirely', () => {
        // Should never happen for a real mapping chain (guaranteed by
        // ensureMappingChainUpToDate), but the pure function must still fail safe.
        const result = analyzeMappingChainRequirements([], []);
        expect(result).toEqual({ needsRequestChain: true, needsResponseChain: true });
    });
});


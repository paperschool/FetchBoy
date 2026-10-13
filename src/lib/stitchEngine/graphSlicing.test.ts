import { describe, it, expect } from 'vitest';
import type { StitchNode, StitchConnection } from '@/types/stitch';
import { getUpstreamNodes } from './graphSlicing';

function makeNode(id: string, type: StitchNode['type'] = 'json-object'): StitchNode {
    return {
        id,
        chainId: 'chain-1',
        type,
        positionX: 0,
        positionY: 0,
        config: {},
        label: null,
        parentNodeId: null,
        createdAt: '',
        updatedAt: '',
    };
}

function makeConn(sourceNodeId: string, targetNodeId: string): StitchConnection {
    return {
        id: `${sourceNodeId}-${targetNodeId}`,
        chainId: 'chain-1',
        sourceNodeId,
        sourceKey: null,
        targetNodeId,
        targetSlot: null,
        createdAt: '',
    };
}

describe('getUpstreamNodes', () => {
    it('returns only the target node when nothing feeds into it', () => {
        const nodes = [makeNode('a'), makeNode('b')];
        const result = getUpstreamNodes('a', nodes, []);
        expect(result.map((n) => n.id)).toEqual(['a']);
    });

    it('collects direct upstream nodes', () => {
        const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
        const connections = [makeConn('a', 'c'), makeConn('b', 'c')];
        const result = getUpstreamNodes('c', nodes, connections);
        expect(result.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('collects transitive upstream nodes across multiple hops', () => {
        const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d'), makeNode('unrelated')];
        const connections = [makeConn('a', 'b'), makeConn('b', 'c'), makeConn('c', 'd'), makeConn('unrelated', 'z')];
        const result = getUpstreamNodes('d', nodes, connections);
        expect(result.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    });

    it('does not include downstream-only or sibling nodes', () => {
        const nodes = [makeNode('a'), makeNode('b'), makeNode('downstream')];
        const connections = [makeConn('a', 'b'), makeConn('b', 'downstream')];
        const result = getUpstreamNodes('b', nodes, connections);
        expect(result.map((n) => n.id).sort()).toEqual(['a', 'b']);
    });

    it('handles cycles without infinite looping', () => {
        const nodes = [makeNode('a'), makeNode('b')];
        const connections = [makeConn('a', 'b'), makeConn('b', 'a')];
        const result = getUpstreamNodes('a', nodes, connections);
        expect(result.map((n) => n.id).sort()).toEqual(['a', 'b']);
    });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { executeLogNode } from './logExecutor';
import type { StitchNode } from '@/types/stitch';

function makeNode(overrides: Partial<StitchNode> & { id: string }): StitchNode {
    return {
        chainId: 'chain-1',
        type: 'log',
        positionX: 0,
        positionY: 0,
        config: {},
        label: null,
        parentNodeId: null,
        createdAt: 'ts',
        updatedAt: 'ts',
        ...overrides,
    };
}

describe('executeLogNode', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('passes the input through unchanged', () => {
        const node = makeNode({ id: 'log-1' });
        const input = { foo: 'bar', count: 3 };
        const result = executeLogNode(node, input);
        expect(result.output).toEqual(input);
    });

    it('logs the input to the console tagged with the node label', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const node = makeNode({ id: 'log-1', label: 'My Log' });
        const input = { foo: 'bar' };
        executeLogNode(node, input);
        expect(spy).toHaveBeenCalledWith('[My Log]', input);
    });

    it('records a consoleLogs entry for the debug log', () => {
        const node = makeNode({ id: 'log-1', label: 'My Log' });
        const result = executeLogNode(node, { foo: 'bar' });
        expect(result.consoleLogs).toHaveLength(1);
        expect(result.consoleLogs[0].level).toBe('log');
        expect(result.consoleLogs[0].args).toContain('[My Log]');
        expect(result.consoleLogs[0].args).toContain('"foo": "bar"');
    });

    it('falls back to a generic tag when the node has no label', () => {
        const node = makeNode({ id: 'log-1', label: null });
        const result = executeLogNode(node, {});
        expect(result.consoleLogs[0].args).toContain('[Log]');
    });
});

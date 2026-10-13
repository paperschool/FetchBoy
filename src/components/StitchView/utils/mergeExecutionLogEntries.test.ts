import { describe, it, expect } from 'vitest';
import type { ExecutionLogEntry } from '@/types/stitch';
import { mergeExecutionLogEntries } from './mergeExecutionLogEntries';

function makeEntry(overrides: Partial<ExecutionLogEntry> & { nodeId: string; status: ExecutionLogEntry['status'] }): ExecutionLogEntry {
    return {
        nodeLabel: 'Node',
        nodeType: 'json-object',
        timestamp: 0,
        ...overrides,
    };
}

describe('mergeExecutionLogEntries', () => {
    it('merges a started+completed pair into one entry, keeping the started timestamp', () => {
        const logs = [
            makeEntry({ nodeId: 'a', status: 'started', timestamp: 10 }),
            makeEntry({ nodeId: 'a', status: 'completed', timestamp: 15, durationMs: 5, output: { ok: true } }),
        ];
        const merged = mergeExecutionLogEntries(logs);
        expect(merged).toHaveLength(1);
        expect(merged[0]).toMatchObject({ nodeId: 'a', status: 'completed', timestamp: 10, durationMs: 5, output: { ok: true } });
    });

    it('merges started+error pairs the same way', () => {
        const logs = [
            makeEntry({ nodeId: 'a', status: 'started', timestamp: 10 }),
            makeEntry({ nodeId: 'a', status: 'error', timestamp: 12, error: 'boom' }),
        ];
        const merged = mergeExecutionLogEntries(logs);
        expect(merged).toHaveLength(1);
        expect(merged[0]).toMatchObject({ status: 'error', timestamp: 10, error: 'boom' });
    });

    it('keeps a "sleeping" entry standalone without consuming the pending started slot', () => {
        const logs = [
            makeEntry({ nodeId: 'a', status: 'started', timestamp: 10 }),
            makeEntry({ nodeId: 'a', status: 'sleeping', timestamp: 11 }),
            makeEntry({ nodeId: 'a', status: 'completed', timestamp: 20, durationMs: 10 }),
        ];
        const merged = mergeExecutionLogEntries(logs);
        expect(merged).toHaveLength(2);
        // The started entry (index 0) is merged in place with "completed"; the
        // standalone "sleeping" entry is appended afterward, not inserted before it.
        expect(merged[0]).toMatchObject({ status: 'completed', timestamp: 10, durationMs: 10 });
        expect(merged[1]).toMatchObject({ status: 'sleeping', timestamp: 11 });
    });

    it('leaves an unmatched running "started" entry as-is', () => {
        const logs = [makeEntry({ nodeId: 'a', status: 'started', timestamp: 10 })];
        const merged = mergeExecutionLogEntries(logs);
        expect(merged).toEqual(logs);
    });

    it('leaves a standalone replayed entry (no preceding started) unmerged', () => {
        const logs = [makeEntry({ nodeId: 'a', status: 'replayed', timestamp: 5, durationMs: 2 })];
        const merged = mergeExecutionLogEntries(logs);
        expect(merged).toEqual(logs);
    });

    it('disambiguates loop iterations of the same node so they merge independently', () => {
        const logs = [
            makeEntry({ nodeId: 'a', status: 'started', timestamp: 0, loopNodeId: 'loop', loopIteration: 1 }),
            makeEntry({ nodeId: 'a', status: 'started', timestamp: 1, loopNodeId: 'loop', loopIteration: 2 }),
            makeEntry({ nodeId: 'a', status: 'completed', timestamp: 2, loopNodeId: 'loop', loopIteration: 1, durationMs: 2 }),
            makeEntry({ nodeId: 'a', status: 'completed', timestamp: 3, loopNodeId: 'loop', loopIteration: 2, durationMs: 2 }),
        ];
        const merged = mergeExecutionLogEntries(logs);
        expect(merged).toHaveLength(2);
        expect(merged[0]).toMatchObject({ loopIteration: 1, status: 'completed', timestamp: 0 });
        expect(merged[1]).toMatchObject({ loopIteration: 2, status: 'completed', timestamp: 1 });
    });

    it('preserves overall chronological order of first appearance', () => {
        const logs = [
            makeEntry({ nodeId: 'a', status: 'started', timestamp: 0 }),
            makeEntry({ nodeId: 'b', status: 'started', timestamp: 1 }),
            makeEntry({ nodeId: 'a', status: 'completed', timestamp: 2 }),
            makeEntry({ nodeId: 'b', status: 'completed', timestamp: 3 }),
        ];
        const merged = mergeExecutionLogEntries(logs);
        expect(merged.map((e) => e.nodeId)).toEqual(['a', 'b']);
    });
});

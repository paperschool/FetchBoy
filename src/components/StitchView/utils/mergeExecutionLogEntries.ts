import type { ExecutionLogEntry } from '@/types/stitch';

const TERMINAL_STATUSES = new Set<ExecutionLogEntry['status']>([
    'completed', 'error', 'cancelled', 'skipped', 'replayed',
]);

/** Disambiguates repeated runs of the same node — most importantly loop iterations. */
function entryKey(entry: ExecutionLogEntry): string {
    return `${entry.nodeId}:${entry.loopNodeId ?? ''}:${entry.loopIteration ?? ''}`;
}

/**
 * Merges each node's "started" log entry with its eventual terminal entry
 * (completed/error/cancelled/skipped) into a single row, instead of the
 * debug log showing two (or three, with a "sleeping" entry in between)
 * separate rows per node execution. Standalone entries (a manual replay, or
 * a terminal entry with no matching "started" — shouldn't normally happen)
 * pass through unmerged. "sleeping" entries never consume the pending
 * "started" slot, since they're informational, not a final outcome.
 */
export function mergeExecutionLogEntries(logs: ExecutionLogEntry[]): ExecutionLogEntry[] {
    const merged: ExecutionLogEntry[] = [];
    const pendingIndex = new Map<string, number>();

    for (const log of logs) {
        const key = entryKey(log);

        if (log.status === 'started') {
            merged.push(log);
            pendingIndex.set(key, merged.length - 1);
            continue;
        }

        if (TERMINAL_STATUSES.has(log.status)) {
            const idx = pendingIndex.get(key);
            if (idx !== undefined) {
                merged[idx] = { ...merged[idx], ...log, timestamp: merged[idx].timestamp };
                pendingIndex.delete(key);
                continue;
            }
        }

        // "sleeping", or a terminal entry with no pending "started" — standalone row.
        merged.push(log);
    }

    return merged;
}

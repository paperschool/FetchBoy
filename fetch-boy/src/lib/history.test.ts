import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearHistory, loadHistory, persistHistoryEntry } from '@/lib/history';

// ─── Mock DB ──────────────────────────────────────────────────────────────────
const { mockExecute, mockSelect, mockGetDb } = vi.hoisted(() => {
    const mockExecute = vi.fn().mockResolvedValue(undefined);
    const mockSelect = vi.fn();
    const mockDb = { execute: mockExecute, select: mockSelect };
    const mockGetDb = vi.fn().mockResolvedValue(mockDb);
    return { mockExecute, mockSelect, mockGetDb };
});

vi.mock('@/lib/db', () => ({
    getDb: mockGetDb,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const makeSnapshot = () =>
    ({
        id: 'req-1',
        collection_id: null,
        folder_id: null,
        name: 'Test Request',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        query_params: [],
        body_type: 'none',
        body_content: '',
        auth_type: 'none',
        auth_config: {},
        sort_order: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    }) as const;

describe('loadHistory', () => {
    beforeEach(() => vi.clearAllMocks());

    it('queries with ORDER BY sent_at DESC LIMIT and parses request_snapshot', async () => {
        const snapshot = makeSnapshot();
        const rawRows = [
            {
                id: 'h1',
                method: 'GET',
                url: 'https://a.com',
                status_code: 200,
                response_time_ms: 100,
                request_snapshot: JSON.stringify(snapshot),
                sent_at: '2024-01-02T00:00:00Z',
            },
            {
                id: 'h2',
                method: 'POST',
                url: 'https://b.com',
                status_code: 201,
                response_time_ms: 200,
                request_snapshot: JSON.stringify(snapshot),
                sent_at: '2024-01-01T00:00:00Z',
            },
        ];
        mockSelect.mockResolvedValue(rawRows);

        const entries = await loadHistory();

        expect(mockSelect).toHaveBeenCalledWith(
            'SELECT * FROM history ORDER BY sent_at DESC LIMIT ?',
            [200],
        );
        expect(entries).toHaveLength(2);
        expect(entries[0].request_snapshot).toEqual(snapshot);
        expect(entries[1].request_snapshot).toEqual(snapshot);
    });

    it('uses the provided limit parameter', async () => {
        mockSelect.mockResolvedValue([]);
        await loadHistory(50);
        expect(mockSelect).toHaveBeenCalledWith(
            'SELECT * FROM history ORDER BY sent_at DESC LIMIT ?',
            [50],
        );
    });
});

describe('clearHistory', () => {
    beforeEach(() => vi.clearAllMocks());

    it('executes DELETE FROM history', async () => {
        await clearHistory();
        expect(mockExecute).toHaveBeenCalledWith('DELETE FROM history');
    });
});

describe('persistHistoryEntry', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns the HistoryEntry it inserted', async () => {
        const snapshot = makeSnapshot();
        const entry = await persistHistoryEntry({
            method: 'POST',
            url: 'https://api.example.com/users',
            statusCode: 201,
            responseTimeMs: 150,
            requestSnapshot: snapshot,
        });

        expect(entry).toMatchObject({
            method: 'POST',
            url: 'https://api.example.com/users',
            status_code: 201,
            response_time_ms: 150,
            request_snapshot: snapshot,
        });
        expect(typeof entry.id).toBe('string');
        expect(entry.id.length).toBeGreaterThan(0);
        expect(typeof entry.sent_at).toBe('string');
        expect(entry.sent_at.length).toBeGreaterThan(0);
    });
});

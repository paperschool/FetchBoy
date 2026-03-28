import { beforeEach, describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@/lib/db';
import { useHistoryStore } from '@/stores/historyStore';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
    id: crypto.randomUUID(),
    method: 'GET',
    url: 'https://example.com',
    status_code: 200,
    response_time_ms: 100,
    request_snapshot: {
        id: 'req-1',
        collection_id: null,
        folder_id: null,
        name: 'Test',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        query_params: [],
        body_type: 'none',
        body_content: '',
        auth_type: 'none',
        auth_config: {},
        pre_request_script: '',
        pre_request_script_enabled: true,
        sort_order: 0,
        created_at: '',
        updated_at: '',
    },
    sent_at: new Date().toISOString(),
    ...overrides,
});

const resetStore = () => useHistoryStore.setState({ entries: [] });

describe('historyStore', () => {
    beforeEach(resetStore);

    describe('loadAll', () => {
        it('replaces entries with the provided list', () => {
            const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
            useHistoryStore.getState().loadAll(entries);
            expect(useHistoryStore.getState().entries).toEqual(entries);
        });

        it('replaces previously loaded entries', () => {
            useHistoryStore.getState().loadAll([makeEntry({ id: 'old' })]);
            const fresh = [makeEntry({ id: 'new1' }), makeEntry({ id: 'new2' })];
            useHistoryStore.getState().loadAll(fresh);
            expect(useHistoryStore.getState().entries).toEqual(fresh);
        });
    });

    describe('addEntry', () => {
        it('prepends entry to front so newest is first', () => {
            const first = makeEntry({ id: 'first' });
            const second = makeEntry({ id: 'second' });
            useHistoryStore.getState().addEntry(first);
            useHistoryStore.getState().addEntry(second);
            expect(useHistoryStore.getState().entries[0]).toEqual(second);
            expect(useHistoryStore.getState().entries[1]).toEqual(first);
        });

        it('trims to 200 entries when exceeded', () => {
            const existing200 = Array.from({ length: 200 }, (_, i) =>
                makeEntry({ id: `entry-${i}` }),
            );
            useHistoryStore.getState().loadAll(existing200);
            const overflow = makeEntry({ id: 'overflow' });
            useHistoryStore.getState().addEntry(overflow);
            const state = useHistoryStore.getState();
            expect(state.entries).toHaveLength(200);
            expect(state.entries[0].id).toBe('overflow');
        });

        it('does not trim when at exactly 200 entries', () => {
            const existing199 = Array.from({ length: 199 }, (_, i) =>
                makeEntry({ id: `entry-${i}` }),
            );
            useHistoryStore.getState().loadAll(existing199);
            useHistoryStore.getState().addEntry(makeEntry({ id: 'entry-199' }));
            expect(useHistoryStore.getState().entries).toHaveLength(200);
        });
    });

    describe('clearAll', () => {
        it('empties entries', () => {
            useHistoryStore.getState().loadAll([makeEntry(), makeEntry()]);
            useHistoryStore.getState().clearAll();
            expect(useHistoryStore.getState().entries).toHaveLength(0);
        });
    });
});

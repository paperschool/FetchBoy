import { describe, expect, it, beforeEach } from 'vitest';
import { useMappingLogStore } from './mappingLogStore';
import type { MappingLogEntry } from './mappingLogStore';

function makeEntry(id: string, url = 'https://example.com'): MappingLogEntry {
    return { id, timestamp: Date.now(), method: 'GET', url, mappingId: 'm1', mappingName: 'Test', overridesApplied: ['headers_add'] };
}

describe('mappingLogStore', () => {
    beforeEach(() => {
        useMappingLogStore.setState({ entries: [], searchQuery: '' });
    });

    it('starts empty', () => {
        expect(useMappingLogStore.getState().entries).toHaveLength(0);
    });

    it('adds entries to the front', () => {
        const store = useMappingLogStore.getState();
        store.addEntry(makeEntry('1'));
        store.addEntry(makeEntry('2'));
        const entries = useMappingLogStore.getState().entries;
        expect(entries).toHaveLength(2);
        expect(entries[0].id).toBe('2');
    });

    it('evicts oldest when exceeding max', () => {
        const store = useMappingLogStore.getState();
        for (let i = 0; i < 505; i++) {
            store.addEntry(makeEntry(`e${i}`));
        }
        expect(useMappingLogStore.getState().entries).toHaveLength(500);
    });

    it('clears all entries', () => {
        const store = useMappingLogStore.getState();
        store.addEntry(makeEntry('1'));
        store.clearLog();
        expect(useMappingLogStore.getState().entries).toHaveLength(0);
    });

    it('sets search query', () => {
        useMappingLogStore.getState().setSearchQuery('test');
        expect(useMappingLogStore.getState().searchQuery).toBe('test');
    });
});

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface MappingLogEntry {
    id: string;
    timestamp: number;
    method: string;
    url: string;
    mappingId: string;
    mappingName: string;
    overridesApplied: string[];
    originalUrl?: string;
    remappedUrl?: string;
}

const MAX_ENTRIES = 500;

interface MappingLogState {
    entries: MappingLogEntry[];
    searchQuery: string;
    addEntry: (entry: MappingLogEntry) => void;
    clearLog: () => void;
    setSearchQuery: (query: string) => void;
}

export const useMappingLogStore = create<MappingLogState>()(
    immer((set) => ({
        entries: [],
        searchQuery: '',

        addEntry: (entry) =>
            set((state) => {
                state.entries.unshift(entry);
                if (state.entries.length > MAX_ENTRIES) {
                    state.entries.length = MAX_ENTRIES;
                }
            }),

        clearLog: () =>
            set((state) => {
                state.entries = [];
            }),

        setSearchQuery: (query) =>
            set((state) => {
                state.searchQuery = query;
            }),
    })),
);

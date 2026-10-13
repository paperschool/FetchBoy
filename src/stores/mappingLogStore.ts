import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { addWithMaxSize } from '@/lib/arrayHelpers';
import { MAX_MAPPING_LOG_ENTRIES } from '@/lib/constants';

export type OverrideSource = 'mapping' | 'breakpoint';

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
    source: OverrideSource;
}

interface MappingLogState {
    entries: MappingLogEntry[];
    searchQuery: string;
    /** Count of entries added since the Overrides tab was last viewed — powers its tab badge. */
    unseenCount: number;
    addEntry: (entry: MappingLogEntry) => void;
    clearLog: () => void;
    setSearchQuery: (query: string) => void;
    markSeen: () => void;
}

export const useMappingLogStore = create<MappingLogState>()(
    immer((set) => ({
        entries: [],
        searchQuery: '',
        unseenCount: 0,

        addEntry: (entry) =>
            set((state) => {
                addWithMaxSize(state.entries, entry, MAX_MAPPING_LOG_ENTRIES, true);
                state.unseenCount += 1;
            }),

        clearLog: () =>
            set((state) => {
                state.entries = [];
                state.unseenCount = 0;
            }),

        setSearchQuery: (query) =>
            set((state) => {
                state.searchQuery = query;
            }),

        markSeen: () => set((state) => { state.unseenCount = 0; }),
    })),
);

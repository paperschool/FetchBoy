import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { HistoryEntry } from '@/lib/db';
import { addWithMaxSize } from '@/lib/arrayHelpers';
import { MAX_HISTORY_ENTRIES } from '@/lib/constants';

interface HistoryState {
    entries: HistoryEntry[];
    loadAll: (entries: HistoryEntry[]) => void;
    addEntry: (entry: HistoryEntry) => void;
    clearAll: () => void;
}

export const useHistoryStore = create<HistoryState>()(
    immer((set) => ({
        entries: [],
        loadAll: (entries) =>
            set((state) => {
                state.entries = entries;
            }),
        addEntry: (entry) =>
            set((state) => { addWithMaxSize(state.entries, entry, MAX_HISTORY_ENTRIES, true); }),
        clearAll: () =>
            set((state) => {
                state.entries = [];
            }),
    })),
);

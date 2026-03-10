import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { HistoryEntry } from '@/lib/db';

const MAX_HISTORY = 200;

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
            set((state) => {
                state.entries.unshift(entry);
                if (state.entries.length > MAX_HISTORY) {
                    state.entries.length = MAX_HISTORY;
                }
            }),
        clearAll: () =>
            set((state) => {
                state.entries = [];
            }),
    })),
);

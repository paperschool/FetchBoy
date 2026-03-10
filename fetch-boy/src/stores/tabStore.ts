import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface TabEntry {
    id: string;
    label: string;
    isCustomLabel: boolean;
}

interface TabStore {
    tabs: TabEntry[];
    activeTabId: string;
    addTab: () => void;
    closeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    renameTab: (id: string, label: string) => void;
    syncLabelFromRequest: (id: string, method: string, url: string) => void;
}

const createInitialTab = (): TabEntry => ({
    id: crypto.randomUUID(),
    label: 'New Request',
    isCustomLabel: false,
});

const initialTab = createInitialTab();

export const useTabStore = create<TabStore>()(
    immer((set) => ({
        tabs: [initialTab],
        activeTabId: initialTab.id,

        addTab: () =>
            set((state) => {
                const newTab: TabEntry = {
                    id: crypto.randomUUID(),
                    label: 'New Request',
                    isCustomLabel: false,
                };
                state.tabs.push(newTab);
                state.activeTabId = newTab.id;
            }),

        closeTab: (id) =>
            set((state) => {
                if (state.tabs.length === 1) return; // blocked — last tab
                const idx = state.tabs.findIndex((t) => t.id === id);
                if (idx === -1) return;
                state.tabs.splice(idx, 1);
                if (state.activeTabId === id) {
                    const newIdx = Math.max(0, idx - 1);
                    state.activeTabId = state.tabs[newIdx].id;
                }
            }),

        setActiveTab: (id) =>
            set((state) => {
                state.activeTabId = id;
            }),

        renameTab: (id, label) =>
            set((state) => {
                const tab = state.tabs.find((t) => t.id === id);
                if (tab) {
                    tab.label = label;
                    tab.isCustomLabel = true;
                }
            }),

        syncLabelFromRequest: (id, method, url) =>
            set((state) => {
                const tab = state.tabs.find((t) => t.id === id);
                if (!tab || tab.isCustomLabel) return;
                if (!url) {
                    tab.label = 'New Request';
                    return;
                }
                const raw = `${method} ${url}`;
                tab.label = raw.length > 30 ? raw.slice(0, 27) + '…' : raw;
            }),
    })),
);

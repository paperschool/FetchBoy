import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';
import type { HttpMethod, RequestTab, AuthState, BodyMode, KeyValueRow } from './requestStore';
import type { ResponseData } from '@/components/ResponseViewer/ResponseViewer';
import type { ConsoleLogEntry, HttpLogEntry, ScriptError } from '@/lib/scriptEngine';
import { useUiSettingsStore } from './uiSettingsStore';

// ─── Script Debug State ──────────────────────────────────────────────────────

export interface ScriptDebugState {
    status: 'idle' | 'running' | 'completed' | 'error';
    consoleLogs: ConsoleLogEntry[];
    httpLogs: HttpLogEntry[];
    error: ScriptError | null;
    startTime: number | null;
    endTime: number | null;
    inputSnapshot: Record<string, unknown> | null;
    outputSnapshot: Record<string, unknown> | null;
}

export function createDefaultScriptDebugState(): ScriptDebugState {
    return {
        status: 'idle',
        consoleLogs: [],
        httpLogs: [],
        error: null,
        startTime: null,
        endTime: null,
        inputSnapshot: null,
        outputSnapshot: null,
    };
}

// ─── Per-tab Data Snapshots ───────────────────────────────────────────────────

export interface RequestSnapshot {
    method: HttpMethod;
    url: string;
    headers: KeyValueRow[];
    queryParams: KeyValueRow[];
    body: { mode: BodyMode; raw: string };
    auth: AuthState;
    activeTab: RequestTab;
    isDirty: boolean;
    timeout: number; // milliseconds; 0 = no timeout
    preRequestScript: string;
    preRequestScriptEnabled: boolean;
    scriptKeepOpen: boolean;
}

export interface ResponseSnapshot {
    responseData: ResponseData | null;
    requestError: string | null;
    sentUrl: string | null;
    verboseLogs: string[];
    requestBodyLanguage: 'json' | 'html' | 'xml';
    isSending: boolean;
    wasCancelled: boolean;
    wasTimedOut: boolean;
    timedOutAfterSec: number | null;
}

export function createDefaultRequestSnapshot(): RequestSnapshot {
    return {
        method: 'GET',
        url: '',
        headers: [],
        queryParams: [],
        body: { mode: 'none', raw: '' },
        auth: { type: 'none' },
        activeTab: 'headers',
        isDirty: false,
        timeout: useUiSettingsStore.getState().requestTimeoutMs,
        preRequestScript: '',
        preRequestScriptEnabled: true,
        scriptKeepOpen: false,
    };
}

export function createDefaultResponseSnapshot(): ResponseSnapshot {
    return {
        responseData: null,
        requestError: null,
        sentUrl: null,
        verboseLogs: [],
        requestBodyLanguage: 'json',
        isSending: false,
        wasCancelled: false,
        wasTimedOut: false,
        timedOutAfterSec: null,
    };
}

// ─── Tab Entry ────────────────────────────────────────────────────────────────

export interface TabEntry {
    id: string;
    label: string;
    isCustomLabel: boolean;
    requestState: RequestSnapshot;
    responseState: ResponseSnapshot;
    scriptDebugState: ScriptDebugState;
    openedFromIntercept?: boolean;
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface TabStore {
    tabs: TabEntry[];
    activeTabId: string;
    addTab: () => void;
    closeTab: (id: string) => void;
    navigateTab: (direction: 'next' | 'prev') => void;
    reorderTabs: (orderedIds: string[]) => void;
    duplicateTab: (id: string) => void;
    closeOtherTabs: (id: string) => void;
    closeAllTabs: () => void;
    setActiveTab: (id: string) => void;
    renameTab: (id: string, label: string) => void;
    syncLabelFromRequest: (id: string, method: string, url: string) => void;
    updateTabRequestState: (id: string, patch: Partial<RequestSnapshot>) => void;
    updateTabResponseState: (id: string, patch: Partial<ResponseSnapshot>) => void;
    updateTabScriptDebugState: (id: string, patch: Partial<ScriptDebugState>) => void;
    appendResponseLog: (id: string, log: string) => void;
    openRequestInNewTab: (snapshot: RequestSnapshot, label: string, meta?: { openedFromIntercept?: boolean }) => void;
    clearOpenedFromIntercept: (id: string) => void;
}

const createInitialTab = (): TabEntry => ({
    id: crypto.randomUUID(),
    label: 'New Request',
    isCustomLabel: false,
    requestState: createDefaultRequestSnapshot(),
    responseState: createDefaultResponseSnapshot(),
    scriptDebugState: createDefaultScriptDebugState(),
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
                    requestState: createDefaultRequestSnapshot(),
                    responseState: createDefaultResponseSnapshot(),
                    scriptDebugState: createDefaultScriptDebugState(),
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

        navigateTab: (direction) =>
            set((state) => {
                if (state.tabs.length <= 1) return;
                const currentIdx = state.tabs.findIndex((t) => t.id === state.activeTabId);
                if (currentIdx === -1) return;
                const delta = direction === 'next' ? 1 : -1;
                const nextIdx = (currentIdx + delta + state.tabs.length) % state.tabs.length;
                state.activeTabId = state.tabs[nextIdx].id;
            }),

        reorderTabs: (orderedIds) =>
            set((state) => {
                if (orderedIds.length !== state.tabs.length) return;
                const tabById = new Map(state.tabs.map((tab) => [tab.id, tab]));
                const hasUnknownId = orderedIds.some((id) => !tabById.has(id));
                if (hasUnknownId) return;

                state.tabs = orderedIds.map((id) => tabById.get(id)!);
            }),

        duplicateTab: (id) =>
            set((state) => {
                const sourceIdx = state.tabs.findIndex((tab) => tab.id === id);
                if (sourceIdx === -1) return;

                const source = state.tabs[sourceIdx];
                const duplicated: TabEntry = {
                    id: crypto.randomUUID(),
                    label: `${source.label} (copy)`,
                    isCustomLabel: true,
                    requestState: structuredClone(current(source.requestState)),
                    responseState: createDefaultResponseSnapshot(),
                    scriptDebugState: createDefaultScriptDebugState(),
                };

                state.tabs.splice(sourceIdx + 1, 0, duplicated);
                state.activeTabId = duplicated.id;
            }),

        closeOtherTabs: (id) =>
            set((state) => {
                const keep = state.tabs.find((tab) => tab.id === id);
                if (!keep) return;
                state.tabs = [keep];
                state.activeTabId = keep.id;
            }),

        closeAllTabs: () =>
            set((state) => {
                const freshTab = createInitialTab();
                state.tabs = [freshTab];
                state.activeTabId = freshTab.id;
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

        updateTabRequestState: (id, patch) =>
            set((state) => {
                const tab = state.tabs.find((t) => t.id === id);
                if (tab) Object.assign(tab.requestState, patch);
            }),

        updateTabResponseState: (id, patch) =>
            set((state) => {
                const tab = state.tabs.find((t) => t.id === id);
                if (tab) Object.assign(tab.responseState, patch);
            }),

        updateTabScriptDebugState: (id, patch) =>
            set((state) => {
                const tab = state.tabs.find((t) => t.id === id);
                if (tab) Object.assign(tab.scriptDebugState, patch);
            }),

        appendResponseLog: (id, log) =>
            set((state) => {
                const tab = state.tabs.find((t) => t.id === id);
                if (tab) tab.responseState.verboseLogs.push(log);
            }),

        openRequestInNewTab: (snapshot, label, meta?) =>
            set((state) => {
                const newTab: TabEntry = {
                    id: crypto.randomUUID(),
                    label,
                    isCustomLabel: true,
                    requestState: { ...snapshot },
                    responseState: createDefaultResponseSnapshot(),
                    scriptDebugState: createDefaultScriptDebugState(),
                    openedFromIntercept: meta?.openedFromIntercept,
                };
                state.tabs.push(newTab);
                state.activeTabId = newTab.id;
            }),

        clearOpenedFromIntercept: (id) =>
            set((state) => {
                const tab = state.tabs.find((t) => t.id === id);
                if (tab) tab.openedFromIntercept = undefined;
            }),
    })),
);

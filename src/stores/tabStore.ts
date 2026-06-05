import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';
import type { HttpMethod, RequestTab, AuthState, BodyMode, KeyValueRow } from './requestStore';
import type { ResponseData } from '@/components/ResponseViewer/ResponseViewer';
import type { ConsoleLogEntry, HttpLogEntry, ScriptError, TestResult } from '@/lib/scriptEngine';
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
    /** Which stage produced this debug state. */
    stage?: 'pre-request' | 'post-response';
    /** Post-response `fb.test` outcomes (Story 20.8). */
    testResults?: TestResult[];
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
    /** The saved request this tab represents (null for an unsaved/new request). */
    savedRequestId: string | null;
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
    preRequestChainId: string | null;
    preRequestTemplateId: string | null;
    preRequestMode: 'none' | 'javascript' | 'chain';
    postResponseScript: string;
    postResponseScriptEnabled: boolean;
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
        savedRequestId: null,
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
        preRequestChainId: null,
        preRequestTemplateId: null,
        preRequestMode: 'none',
        postResponseScript: '',
        postResponseScriptEnabled: false,
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
    /** Collection-wide "global" pre-request stage execution. */
    globalDebugState: ScriptDebugState;
    /** The request's own pre-request stage execution (linked template + inline script). */
    scriptDebugState: ScriptDebugState;
    /** Post-response stage execution, kept separately so each stage can be shown. */
    postResponseDebugState: ScriptDebugState;
    openedFromIntercept?: boolean;
}

/**
 * A tab has unsaved edits to a SAVED request — the one condition that gates a
 * close behind an unsaved-changes prompt (Story 22.3). Shared by the store's
 * requestCloseTab and the TabBar bulk-close guards so the two can't diverge.
 */
export const tabHasUnsavedSavedRequest = (tab: TabEntry): boolean =>
    tab.requestState.savedRequestId !== null && tab.requestState.isDirty;

// ─── Store Interface ──────────────────────────────────────────────────────────

interface TabStore {
    tabs: TabEntry[];
    activeTabId: string;
    /** Tab awaiting an unsaved-changes decision before it closes (Story 22.3). */
    pendingCloseTabId: string | null;
    addTab: () => void;
    closeTab: (id: string) => void;
    /** Close a tab, prompting first when it has unsaved edits to a saved request. */
    requestCloseTab: (id: string) => void;
    cancelPendingClose: () => void;
    navigateTab: (direction: 'next' | 'prev') => void;
    reorderTabs: (orderedIds: string[]) => void;
    duplicateTab: (id: string) => void;
    closeOtherTabs: (id: string) => void;
    closeAllTabs: () => void;
    setActiveTab: (id: string) => void;
    renameTab: (id: string, label: string) => void;
    renameSavedRequestTabs: (savedRequestId: string, name: string) => void;
    syncLabelFromRequest: (id: string, method: string, url: string) => void;
    updateTabRequestState: (id: string, patch: Partial<RequestSnapshot>) => void;
    updateTabResponseState: (id: string, patch: Partial<ResponseSnapshot>) => void;
    updateTabGlobalDebugState: (id: string, patch: Partial<ScriptDebugState>) => void;
    updateTabScriptDebugState: (id: string, patch: Partial<ScriptDebugState>) => void;
    updateTabPostResponseDebugState: (id: string, patch: Partial<ScriptDebugState>) => void;
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
    globalDebugState: createDefaultScriptDebugState(),
    scriptDebugState: createDefaultScriptDebugState(),
    postResponseDebugState: createDefaultScriptDebugState(),
});

const initialTab = createInitialTab();

export const useTabStore = create<TabStore>()(
    immer((set, get) => ({
        tabs: [initialTab],
        activeTabId: initialTab.id,
        pendingCloseTabId: null,

        addTab: () =>
            set((state) => {
                const newTab: TabEntry = {
                    id: crypto.randomUUID(),
                    label: 'New Request',
                    isCustomLabel: false,
                    requestState: createDefaultRequestSnapshot(),
                    responseState: createDefaultResponseSnapshot(),
                    globalDebugState: createDefaultScriptDebugState(),
                    scriptDebugState: createDefaultScriptDebugState(),
                    postResponseDebugState: createDefaultScriptDebugState(),
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
                if (state.pendingCloseTabId === id) state.pendingCloseTabId = null;
                if (state.activeTabId === id) {
                    const newIdx = Math.max(0, idx - 1);
                    state.activeTabId = state.tabs[newIdx].id;
                }
            }),

        // Story 22.3 — gate closing a tab that has unsaved edits to a SAVED request.
        // Dirty+saved → raise a pending-close prompt; otherwise close immediately.
        requestCloseTab: (id) => {
            const state = get();
            if (state.tabs.length === 1) return; // can't close the last tab
            const tab = state.tabs.find((t) => t.id === id);
            if (!tab) return;
            if (tabHasUnsavedSavedRequest(tab)) {
                set((s) => {
                    s.pendingCloseTabId = id;
                });
            } else {
                get().closeTab(id);
            }
        },

        cancelPendingClose: () =>
            set((state) => {
                state.pendingCloseTabId = null;
            }),

        // Story 22.4 — keep an open tab's title in sync when its saved request is renamed.
        renameSavedRequestTabs: (savedRequestId, name) =>
            set((state) => {
                for (const tab of state.tabs) {
                    if (tab.requestState.savedRequestId === savedRequestId) {
                        tab.label = name;
                        tab.isCustomLabel = true;
                    }
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
                    globalDebugState: createDefaultScriptDebugState(),
                    scriptDebugState: createDefaultScriptDebugState(),
                    postResponseDebugState: createDefaultScriptDebugState(),
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

        updateTabGlobalDebugState: (id, patch) =>
            set((state) => {
                const tab = state.tabs.find((t) => t.id === id);
                if (tab) Object.assign(tab.globalDebugState, patch);
            }),

        updateTabScriptDebugState: (id, patch) =>
            set((state) => {
                const tab = state.tabs.find((t) => t.id === id);
                if (tab) Object.assign(tab.scriptDebugState, patch);
            }),

        updateTabPostResponseDebugState: (id, patch) =>
            set((state) => {
                const tab = state.tabs.find((t) => t.id === id);
                if (tab) Object.assign(tab.postResponseDebugState, patch);
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
                    globalDebugState: createDefaultScriptDebugState(),
                    scriptDebugState: createDefaultScriptDebugState(),
                    postResponseDebugState: createDefaultScriptDebugState(),
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

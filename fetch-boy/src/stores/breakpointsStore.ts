import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Breakpoint, BreakpointFolder, BreakpointHeader } from '@/lib/db';
import {
    createBreakpoint as dbCreateBreakpoint,
    updateBreakpoint as dbUpdateBreakpoint,
} from '@/lib/breakpoints';

export type MatchType = 'exact' | 'partial' | 'wildcard' | 'regex';

export interface EditForm {
    id: string | null;
    name: string;
    urlPattern: string;
    matchType: MatchType;
    enabled: boolean;
    folderId: string | null;
    responseMappingEnabled: boolean;
    responseMappingBody: string;
    responseMappingContentType: string;
    statusCodeEnabled: boolean;
    statusCodeValue: number;
    customHeaders: BreakpointHeader[];
}

const defaultEditForm: EditForm = {
    id: null,
    name: 'New Breakpoint',
    urlPattern: '',
    matchType: 'partial',
    enabled: true,
    folderId: null,
    responseMappingEnabled: false,
    responseMappingBody: '',
    responseMappingContentType: 'application/json',
    statusCodeEnabled: false,
    statusCodeValue: 200,
    customHeaders: [],
};

// ─── URL Validation Utilities ─────────────────────────────────────────────────

export function validateUrlPattern(pattern: string, matchType: MatchType): string | null {
    if (!pattern.trim()) return 'URL pattern is required';
    if (matchType === 'regex') {
        try {
            new RegExp(pattern);
        } catch {
            return 'Invalid regex pattern';
        }
    }
    return null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface BreakpointsState {
    folders: BreakpointFolder[];
    breakpoints: Breakpoint[];

    // Editor state
    selectedBreakpointId: string | null;
    isEditing: boolean;
    editForm: EditForm;

    loadAll: (folders: BreakpointFolder[], breakpoints: Breakpoint[]) => void;

    // Folder actions
    addFolder: (folder: BreakpointFolder) => void;
    renameFolder: (id: string, name: string) => void;
    deleteFolder: (id: string) => void;

    // Breakpoint actions
    addBreakpoint: (breakpoint: Breakpoint) => void;
    updateBreakpoint: (id: string, changes: Partial<Pick<Breakpoint, 'name' | 'url_pattern' | 'match_type' | 'enabled'>>) => void;
    deleteBreakpoint: (id: string) => void;

    // Editor actions
    selectBreakpoint: (id: string | null) => void;
    startEditing: (breakpoint?: Breakpoint, folderId?: string | null) => void;
    cancelEditing: () => void;
    saveBreakpoint: (form: EditForm) => Promise<void>;
}

export const useBreakpointsStore = create<BreakpointsState>()(
    immer((set) => ({
        folders: [],
        breakpoints: [],
        selectedBreakpointId: null,
        isEditing: false,
        editForm: { ...defaultEditForm },

        loadAll: (folders, breakpoints) =>
            set((state) => {
                state.folders = folders;
                state.breakpoints = breakpoints;
            }),

        addFolder: (folder) =>
            set((state) => {
                state.folders.push(folder);
            }),

        renameFolder: (id, name) =>
            set((state) => {
                const folder = state.folders.find((f) => f.id === id);
                if (folder) folder.name = name;
            }),

        deleteFolder: (id) =>
            set((state) => {
                state.folders = state.folders.filter((f) => f.id !== id);
                state.breakpoints = state.breakpoints.filter((bp) => bp.folder_id !== id);
            }),

        addBreakpoint: (breakpoint) =>
            set((state) => {
                state.breakpoints.push(breakpoint);
            }),

        updateBreakpoint: (id, changes) =>
            set((state) => {
                const bp = state.breakpoints.find((b) => b.id === id);
                if (bp) Object.assign(bp, changes);
            }),

        deleteBreakpoint: (id) =>
            set((state) => {
                state.breakpoints = state.breakpoints.filter((bp) => bp.id !== id);
            }),

        selectBreakpoint: (id) =>
            set((state) => {
                state.selectedBreakpointId = id;
            }),

        startEditing: (breakpoint?, folderId?) =>
            set((state) => {
                state.isEditing = true;
                if (breakpoint) {
                    state.selectedBreakpointId = breakpoint.id;
                    state.editForm = {
                        id: breakpoint.id,
                        name: breakpoint.name,
                        urlPattern: breakpoint.url_pattern,
                        matchType: breakpoint.match_type,
                        enabled: breakpoint.enabled,
                        folderId: breakpoint.folder_id,
                        responseMappingEnabled: breakpoint.response_mapping_enabled,
                        responseMappingBody: breakpoint.response_mapping_body,
                        responseMappingContentType: breakpoint.response_mapping_content_type,
                        statusCodeEnabled: breakpoint.status_code_enabled,
                        statusCodeValue: breakpoint.status_code_value,
                        customHeaders: breakpoint.custom_headers,
                    };
                } else {
                    state.selectedBreakpointId = null;
                    state.editForm = {
                        ...defaultEditForm,
                        folderId: folderId ?? null,
                    };
                }
            }),

        cancelEditing: () =>
            set((state) => {
                state.isEditing = false;
                state.editForm = { ...defaultEditForm };
            }),

        saveBreakpoint: async (form: EditForm) => {
            if (form.id === null) {
                const bp = await dbCreateBreakpoint(
                    form.folderId,
                    form.name,
                    form.urlPattern,
                    form.matchType,
                );
                await dbUpdateBreakpoint(bp.id, {
                    response_mapping_enabled: form.responseMappingEnabled,
                    response_mapping_body: form.responseMappingBody,
                    response_mapping_content_type: form.responseMappingContentType,
                    status_code_enabled: form.statusCodeEnabled,
                    status_code_value: form.statusCodeValue,
                    custom_headers: form.customHeaders,
                });
                set((state) => {
                    state.breakpoints.push({
                        ...bp,
                        response_mapping_enabled: form.responseMappingEnabled,
                        response_mapping_body: form.responseMappingBody,
                        response_mapping_content_type: form.responseMappingContentType,
                        status_code_enabled: form.statusCodeEnabled,
                        status_code_value: form.statusCodeValue,
                        custom_headers: form.customHeaders,
                    });
                    state.isEditing = false;
                    state.editForm = { ...defaultEditForm };
                });
            } else {
                await dbUpdateBreakpoint(form.id, {
                    name: form.name,
                    url_pattern: form.urlPattern,
                    match_type: form.matchType,
                    enabled: form.enabled,
                    response_mapping_enabled: form.responseMappingEnabled,
                    response_mapping_body: form.responseMappingBody,
                    response_mapping_content_type: form.responseMappingContentType,
                    status_code_enabled: form.statusCodeEnabled,
                    status_code_value: form.statusCodeValue,
                    custom_headers: form.customHeaders,
                });
                set((state) => {
                    const bp = state.breakpoints.find((b) => b.id === form.id);
                    if (bp) {
                        bp.name = form.name;
                        bp.url_pattern = form.urlPattern;
                        bp.match_type = form.matchType;
                        bp.enabled = form.enabled;
                        bp.response_mapping_enabled = form.responseMappingEnabled;
                        bp.response_mapping_body = form.responseMappingBody;
                        bp.response_mapping_content_type = form.responseMappingContentType;
                        bp.status_code_enabled = form.statusCodeEnabled;
                        bp.status_code_value = form.statusCodeValue;
                        bp.custom_headers = form.customHeaders;
                    }
                    state.isEditing = false;
                    state.editForm = { ...defaultEditForm };
                });
            }
        },
    })),
);

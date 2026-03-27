import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Breakpoint, BreakpointFolder, BreakpointHeader } from '@/lib/db';
import {
    createBreakpoint as dbCreateBreakpoint,
    updateBreakpoint as dbUpdateBreakpoint,
    syncBreakpointsToProxy,
} from '@/lib/breakpoints';
import { saveEntity, breakpointFormToDb } from '@/stores/helpers/crudStoreHelpers';

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
    blockRequestEnabled: boolean;
    blockRequestStatusCode: number;
    blockRequestBody: string;
}

const defaultEditForm: EditForm = {
    id: null, name: 'New Breakpoint', urlPattern: '', matchType: 'partial',
    enabled: true, folderId: null,
    responseMappingEnabled: false, responseMappingBody: '', responseMappingContentType: 'application/json',
    statusCodeEnabled: false, statusCodeValue: 200, customHeaders: [],
    blockRequestEnabled: false, blockRequestStatusCode: 501, blockRequestBody: '',
};

export function validateUrlPattern(pattern: string, matchType: MatchType): string | null {
    if (!pattern.trim()) return 'URL pattern is required';
    if (matchType === 'regex') {
        try { new RegExp(pattern); } catch { return 'Invalid regex pattern'; }
    }
    return null;
}

/** Map DB entity → edit form. */
function entityToForm(bp: Breakpoint): EditForm {
    return {
        id: bp.id, name: bp.name, urlPattern: bp.url_pattern, matchType: bp.match_type,
        enabled: bp.enabled, folderId: bp.folder_id,
        responseMappingEnabled: bp.response_mapping_enabled, responseMappingBody: bp.response_mapping_body,
        responseMappingContentType: bp.response_mapping_content_type,
        statusCodeEnabled: bp.status_code_enabled, statusCodeValue: bp.status_code_value,
        customHeaders: bp.custom_headers,
        blockRequestEnabled: bp.block_request_enabled, blockRequestStatusCode: bp.block_request_status_code,
        blockRequestBody: bp.block_request_body,
    };
}

interface BreakpointsState {
    folders: BreakpointFolder[];
    breakpoints: Breakpoint[];
    selectedBreakpointId: string | null;
    isEditing: boolean;
    editForm: EditForm;

    loadAll: (folders: BreakpointFolder[], breakpoints: Breakpoint[]) => void;
    addFolder: (folder: BreakpointFolder) => void;
    renameFolder: (id: string, name: string) => void;
    deleteFolder: (id: string) => void;
    addBreakpoint: (breakpoint: Breakpoint) => void;
    updateBreakpoint: (id: string, changes: Partial<Pick<Breakpoint, 'name' | 'url_pattern' | 'match_type' | 'enabled'>>) => void;
    toggleBreakpointEnabled: (id: string) => Promise<void>;
    deleteBreakpoint: (id: string) => void;
    selectBreakpoint: (id: string | null) => void;
    startEditing: (breakpoint?: Breakpoint, folderId?: string | null) => void;
    cancelEditing: () => void;
    saveBreakpoint: (form: EditForm) => Promise<void>;
}

export const useBreakpointsStore = create<BreakpointsState>()(
    immer((set, get) => ({
        folders: [],
        breakpoints: [],
        selectedBreakpointId: null,
        isEditing: false,
        editForm: { ...defaultEditForm },

        loadAll: (folders, breakpoints) =>
            set((state) => { state.folders = folders; state.breakpoints = breakpoints; }),

        addFolder: (folder) =>
            set((state) => { state.folders.push(folder); }),

        renameFolder: (id, name) =>
            set((state) => { const f = state.folders.find((x) => x.id === id); if (f) f.name = name; }),

        deleteFolder: (id) =>
            set((state) => {
                state.folders = state.folders.filter((f) => f.id !== id);
                state.breakpoints = state.breakpoints.filter((bp) => bp.folder_id !== id);
            }),

        addBreakpoint: (breakpoint) =>
            set((state) => { state.breakpoints.push(breakpoint); }),

        updateBreakpoint: (id, changes) =>
            set((state) => { const bp = state.breakpoints.find((b) => b.id === id); if (bp) Object.assign(bp, changes); }),

        toggleBreakpointEnabled: async (id) => {
            const bp = get().breakpoints.find((b) => b.id === id);
            if (!bp) return;
            const newEnabled = !bp.enabled;
            set((state) => { const found = state.breakpoints.find((b) => b.id === id); if (found) found.enabled = newEnabled; });
            try {
                await dbUpdateBreakpoint(id, { enabled: newEnabled });
                await syncBreakpointsToProxy(get().breakpoints);
            } catch {
                set((state) => { const found = state.breakpoints.find((b) => b.id === id); if (found) found.enabled = !newEnabled; });
            }
        },

        deleteBreakpoint: (id) =>
            set((state) => { state.breakpoints = state.breakpoints.filter((bp) => bp.id !== id); }),

        selectBreakpoint: (id) =>
            set((state) => { state.selectedBreakpointId = id; }),

        startEditing: (breakpoint?, folderId?) =>
            set((state) => {
                state.isEditing = true;
                if (breakpoint) {
                    state.selectedBreakpointId = breakpoint.id;
                    state.editForm = entityToForm(breakpoint);
                } else {
                    state.selectedBreakpointId = null;
                    state.editForm = { ...defaultEditForm, folderId: folderId ?? null };
                }
            }),

        cancelEditing: () =>
            set((state) => { state.isEditing = false; state.editForm = { ...defaultEditForm }; }),

        saveBreakpoint: async (form: EditForm) => {
            await saveEntity({
                form,
                dbCreate: (f) => dbCreateBreakpoint(f.folderId, f.name, f.urlPattern, f.matchType),
                dbUpdate: dbUpdateBreakpoint,
                formToDbChanges: breakpointFormToDb,
                applyToState: (entity, isNew) => {
                    set((state) => {
                        if (isNew) {
                            state.breakpoints.push(entity as unknown as Breakpoint);
                        } else {
                            const bp = state.breakpoints.find((b) => b.id === form.id);
                            if (bp) Object.assign(bp, breakpointFormToDb(form));
                        }
                        state.isEditing = false;
                        state.editForm = { ...defaultEditForm };
                    });
                },
            });
            await syncBreakpointsToProxy(get().breakpoints);
        },
    })),
);

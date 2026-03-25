import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Mapping, MappingFolder, MappingHeader, MappingCookie } from '@/lib/db';
import {
    createMapping as dbCreateMapping,
    updateMapping as dbUpdateMapping,
    deleteMapping as dbDeleteMapping,
    syncMappingsToProxy,
} from '@/lib/mappings';

export type MatchType = 'exact' | 'partial' | 'wildcard' | 'regex';

export interface MappingEditForm {
    id: string | null;
    name: string;
    urlPattern: string;
    matchType: MatchType;
    enabled: boolean;
    folderId: string | null;
    headersAdd: MappingHeader[];
    headersRemove: MappingHeader[];
    cookies: MappingCookie[];
    responseBodyEnabled: boolean;
    responseBody: string;
    responseBodyContentType: string;
    responseBodyFilePath: string;
    urlRemapEnabled: boolean;
    urlRemapTarget: string;
}

const defaultEditForm: MappingEditForm = {
    id: null,
    name: 'New Mapping',
    urlPattern: '',
    matchType: 'partial',
    enabled: true,
    folderId: null,
    headersAdd: [],
    headersRemove: [],
    cookies: [],
    responseBodyEnabled: false,
    responseBody: '',
    responseBodyContentType: 'application/json',
    responseBodyFilePath: '',
    urlRemapEnabled: false,
    urlRemapTarget: '',
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface MappingsState {
    folders: MappingFolder[];
    mappings: Mapping[];

    // Editor state
    selectedMappingId: string | null;
    isEditing: boolean;
    editForm: MappingEditForm;

    loadAll: (folders: MappingFolder[], mappings: Mapping[]) => void;

    // Folder actions
    addFolder: (folder: MappingFolder) => void;
    renameFolder: (id: string, name: string) => void;
    deleteFolder: (id: string) => void;

    // Mapping actions
    createMapping: (folderId: string | null, name: string, urlPattern: string, matchType: MatchType) => Promise<void>;
    updateMapping: (id: string, changes: Partial<Mapping>) => Promise<void>;
    deleteMapping: (id: string) => Promise<void>;
    toggleEnabled: (id: string) => Promise<void>;

    // Editor actions
    selectMapping: (id: string | null) => void;
    startEditing: (mapping?: Mapping, folderId?: string | null) => void;
    cancelEditing: () => void;
    saveMapping: (form: MappingEditForm) => Promise<void>;
}

export const useMappingsStore = create<MappingsState>()(
    immer((set, get) => ({
        folders: [],
        mappings: [],
        selectedMappingId: null,
        isEditing: false,
        editForm: { ...defaultEditForm },

        loadAll: (folders, mappings) =>
            set((state) => {
                state.folders = folders;
                state.mappings = mappings;
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
                state.mappings = state.mappings.filter((m) => m.folder_id !== id);
            }),

        createMapping: async (folderId, name, urlPattern, matchType) => {
            const mapping = await dbCreateMapping(folderId, name, urlPattern, matchType);
            set((state) => {
                state.mappings.push(mapping);
            });
            await syncMappingsToProxy(get().mappings);
        },

        updateMapping: async (id, changes) => {
            await dbUpdateMapping(id, changes);
            set((state) => {
                const m = state.mappings.find((x) => x.id === id);
                if (m) Object.assign(m, changes);
            });
            await syncMappingsToProxy(get().mappings);
        },

        deleteMapping: async (id) => {
            await dbDeleteMapping(id);
            set((state) => {
                state.mappings = state.mappings.filter((m) => m.id !== id);
            });
            await syncMappingsToProxy(get().mappings);
        },

        toggleEnabled: async (id) => {
            const m = get().mappings.find((x) => x.id === id);
            if (!m) return;
            const newEnabled = !m.enabled;
            set((state) => {
                const found = state.mappings.find((x) => x.id === id);
                if (found) found.enabled = newEnabled;
            });
            await dbUpdateMapping(id, { enabled: newEnabled });
            await syncMappingsToProxy(get().mappings);
        },

        selectMapping: (id) =>
            set((state) => {
                state.selectedMappingId = id;
            }),

        startEditing: (mapping?, folderId?) =>
            set((state) => {
                state.isEditing = true;
                if (mapping) {
                    state.selectedMappingId = mapping.id;
                    state.editForm = {
                        id: mapping.id,
                        name: mapping.name,
                        urlPattern: mapping.url_pattern,
                        matchType: mapping.match_type,
                        enabled: mapping.enabled,
                        folderId: mapping.folder_id,
                        headersAdd: mapping.headers_add,
                        headersRemove: mapping.headers_remove,
                        cookies: mapping.cookies,
                        responseBodyEnabled: mapping.response_body_enabled,
                        responseBody: mapping.response_body,
                        responseBodyContentType: mapping.response_body_content_type,
                        responseBodyFilePath: mapping.response_body_file_path,
                        urlRemapEnabled: mapping.url_remap_enabled,
                        urlRemapTarget: mapping.url_remap_target,
                    };
                } else {
                    state.selectedMappingId = null;
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

        saveMapping: async (form: MappingEditForm) => {
            const changes = {
                name: form.name,
                url_pattern: form.urlPattern,
                match_type: form.matchType,
                enabled: form.enabled,
                headers_add: form.headersAdd,
                headers_remove: form.headersRemove,
                cookies: form.cookies,
                response_body_enabled: form.responseBodyEnabled,
                response_body: form.responseBody,
                response_body_content_type: form.responseBodyContentType,
                response_body_file_path: form.responseBodyFilePath,
                url_remap_enabled: form.urlRemapEnabled,
                url_remap_target: form.urlRemapTarget,
            };

            if (form.id === null) {
                const mapping = await dbCreateMapping(
                    form.folderId,
                    form.name,
                    form.urlPattern,
                    form.matchType,
                );
                await dbUpdateMapping(mapping.id, changes);
                set((state) => {
                    state.mappings.push({ ...mapping, ...changes });
                    state.isEditing = false;
                    state.editForm = { ...defaultEditForm };
                });
            } else {
                await dbUpdateMapping(form.id, changes);
                set((state) => {
                    const m = state.mappings.find((x) => x.id === form.id);
                    if (m) Object.assign(m, changes);
                    state.isEditing = false;
                    state.editForm = { ...defaultEditForm };
                });
            }
            await syncMappingsToProxy(get().mappings);
        },
    })),
);

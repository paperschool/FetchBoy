import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Mapping, MappingFolder, MappingHeader, MappingCookie } from '@/lib/db';
import {
    createMapping as dbCreateMapping,
    updateMapping as dbUpdateMapping,
    deleteMapping as dbDeleteMapping,
    syncMappingsToProxy,
} from '@/lib/mappings';
import { saveEntity, mappingFormToDb } from '@/stores/helpers/crudStoreHelpers';

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
    id: null, name: 'New Mapping', urlPattern: '', matchType: 'partial',
    enabled: true, folderId: null,
    headersAdd: [], headersRemove: [], cookies: [],
    responseBodyEnabled: false, responseBody: '', responseBodyContentType: 'application/json',
    responseBodyFilePath: '',
    urlRemapEnabled: false, urlRemapTarget: '',
};

/** Map DB entity → edit form. */
function entityToForm(m: Mapping): MappingEditForm {
    return {
        id: m.id, name: m.name, urlPattern: m.url_pattern, matchType: m.match_type,
        enabled: m.enabled, folderId: m.folder_id,
        headersAdd: m.headers_add, headersRemove: m.headers_remove, cookies: m.cookies,
        responseBodyEnabled: m.response_body_enabled, responseBody: m.response_body,
        responseBodyContentType: m.response_body_content_type, responseBodyFilePath: m.response_body_file_path,
        urlRemapEnabled: m.url_remap_enabled, urlRemapTarget: m.url_remap_target,
    };
}

interface MappingsState {
    folders: MappingFolder[];
    mappings: Mapping[];
    selectedMappingId: string | null;
    isEditing: boolean;
    editForm: MappingEditForm;

    loadAll: (folders: MappingFolder[], mappings: Mapping[]) => void;
    addFolder: (folder: MappingFolder) => void;
    renameFolder: (id: string, name: string) => void;
    deleteFolder: (id: string) => void;
    createMapping: (folderId: string | null, name: string, urlPattern: string, matchType: MatchType) => Promise<void>;
    updateMapping: (id: string, changes: Partial<Mapping>) => Promise<void>;
    deleteMapping: (id: string) => Promise<void>;
    toggleEnabled: (id: string) => Promise<void>;
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
            set((state) => { state.folders = folders; state.mappings = mappings; }),

        addFolder: (folder) =>
            set((state) => { state.folders.push(folder); }),

        renameFolder: (id, name) =>
            set((state) => { const f = state.folders.find((x) => x.id === id); if (f) f.name = name; }),

        deleteFolder: (id) =>
            set((state) => {
                state.folders = state.folders.filter((f) => f.id !== id);
                state.mappings = state.mappings.filter((m) => m.folder_id !== id);
            }),

        createMapping: async (folderId, name, urlPattern, matchType) => {
            const mapping = await dbCreateMapping(folderId, name, urlPattern, matchType);
            set((state) => { state.mappings.push(mapping); });
            await syncMappingsToProxy(get().mappings);
        },

        updateMapping: async (id, changes) => {
            await dbUpdateMapping(id, changes);
            set((state) => { const m = state.mappings.find((x) => x.id === id); if (m) Object.assign(m, changes); });
            await syncMappingsToProxy(get().mappings);
        },

        deleteMapping: async (id) => {
            await dbDeleteMapping(id);
            set((state) => { state.mappings = state.mappings.filter((m) => m.id !== id); });
            await syncMappingsToProxy(get().mappings);
        },

        toggleEnabled: async (id) => {
            const m = get().mappings.find((x) => x.id === id);
            if (!m) return;
            const newEnabled = !m.enabled;
            set((state) => { const found = state.mappings.find((x) => x.id === id); if (found) found.enabled = newEnabled; });
            try {
                await dbUpdateMapping(id, { enabled: newEnabled });
                await syncMappingsToProxy(get().mappings);
            } catch {
                set((state) => { const found = state.mappings.find((x) => x.id === id); if (found) found.enabled = !newEnabled; });
            }
        },

        selectMapping: (id) =>
            set((state) => { state.selectedMappingId = id; }),

        startEditing: (mapping?, folderId?) =>
            set((state) => {
                state.isEditing = true;
                if (mapping) {
                    state.selectedMappingId = mapping.id;
                    state.editForm = entityToForm(mapping);
                } else {
                    state.selectedMappingId = null;
                    state.editForm = { ...defaultEditForm, folderId: folderId ?? null };
                }
            }),

        cancelEditing: () =>
            set((state) => { state.isEditing = false; state.editForm = { ...defaultEditForm }; }),

        saveMapping: async (form: MappingEditForm) => {
            await saveEntity({
                form,
                dbCreate: (f) => dbCreateMapping(f.folderId, f.name, f.urlPattern, f.matchType),
                dbUpdate: dbUpdateMapping,
                formToDbChanges: mappingFormToDb,
                applyToState: (entity, isNew) => {
                    set((state) => {
                        if (isNew) {
                            state.mappings.push(entity as unknown as Mapping);
                        } else {
                            const m = state.mappings.find((x) => x.id === form.id);
                            if (m) Object.assign(m, mappingFormToDb(form));
                        }
                        state.isEditing = false;
                        state.editForm = { ...defaultEditForm };
                    });
                },
            });
            await syncMappingsToProxy(get().mappings);
        },
    })),
);

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Collection, Folder, Request } from '@/lib/db';
import { selectOwnedEnvironmentsToDelete } from '@/lib/collections';
import { useEnvironmentStore } from '@/stores/environmentStore';

// ─── Tree Types ───────────────────────────────────────────────────────────────

export interface TreeRequest {
    type: 'request';
    item: Request;
}

export interface TreeFolder {
    type: 'folder';
    item: Folder;
    depth: number; // 0-based; collection-level folders are depth 0
    folders: TreeFolder[]; // nested sub-folders (sorted by sort_order)
    requests: TreeRequest[]; // this folder's requests (sorted by sort_order)
}

export interface TreeCollection {
    type: 'collection';
    item: Collection;
    folders: TreeFolder[]; // top-level folders (parent_id === null)
    requests: TreeRequest[]; // direct requests (no folder)
}

// ─── State ────────────────────────────────────────────────────────────────────

interface CollectionState {
    collections: Collection[];
    folders: Folder[];
    requests: Request[];
    activeRequestId: string | null;

    // Bulk load
    loadAll: (collections: Collection[], folders: Folder[], requests: Request[]) => void;

    // Active request
    setActiveRequest: (id: string | null) => void;

    // Collection CRUD
    addCollection: (collection: Collection) => void;
    renameCollection: (id: string, name: string) => void;
    setCollectionScript: (id: string, script: string, enabled: boolean) => void;
    setCollectionDefaultEnvironment: (id: string, environmentId: string | null) => void;
    deleteCollection: (id: string) => void;

    // Folder CRUD
    addFolder: (folder: Folder) => void;
    renameFolder: (id: string, name: string) => void;
    moveFolder: (id: string, parentId: string | null) => void;
    deleteFolder: (id: string) => void;

    // Request CRUD
    addRequest: (request: Request) => void;
    renameRequest: (id: string, name: string) => void;
    deleteRequest: (id: string) => void;
    updateRequest: (id: string, changes: Partial<Omit<Request, 'id' | 'created_at'>>) => void;
    clearTemplateLinks: (templateId: string) => void;

    // Reorder
    reorderFolders: (collectionId: string, orderedIds: string[]) => void;
    reorderRequests: (
        collectionId: string,
        folderId: string | null,
        orderedIds: string[],
    ) => void;

    // Derived selector
    getCollectionTree: () => TreeCollection[];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCollectionStore = create<CollectionState>()(
    immer((set, get) => ({
        collections: [],
        folders: [],
        requests: [],
        activeRequestId: null,

        loadAll: (collections, folders, requests) =>
            set((state) => {
                state.collections = collections;
                state.folders = folders;
                state.requests = requests;
            }),

        setActiveRequest: (id) =>
            set((state) => {
                state.activeRequestId = id;
            }),

        addCollection: (collection) =>
            set((state) => {
                state.collections.push(collection);
            }),

        renameCollection: (id, name) =>
            set((state) => {
                const col = state.collections.find((c) => c.id === id);
                if (col) col.name = name;
            }),

        setCollectionScript: (id, script, enabled) =>
            set((state) => {
                const col = state.collections.find((c) => c.id === id);
                if (col) {
                    col.pre_request_script = script;
                    col.pre_request_script_enabled = enabled;
                }
            }),

        setCollectionDefaultEnvironment: (id, environmentId) =>
            set((state) => {
                const col = state.collections.find((c) => c.id === id);
                if (col) col.default_environment_id = environmentId;
            }),

        deleteCollection: (id) => {
            // Mirror the DB cascade: drop environments owned by this collection that
            // no other collection still references (active-env fallback handled by
            // environmentStore.deleteEnvironment). Compute against the pre-delete snapshot.
            const envStore = useEnvironmentStore.getState();
            const envIdsToRemove = selectOwnedEnvironmentsToDelete(
                id,
                envStore.environments,
                get().collections,
            );
            set((state) => {
                const folderIds = state.folders
                    .filter((f) => f.collection_id === id)
                    .map((f) => f.id);
                state.collections = state.collections.filter((c) => c.id !== id);
                state.folders = state.folders.filter((f) => f.collection_id !== id);
                state.requests = state.requests.filter(
                    (r) =>
                        r.collection_id !== id && !folderIds.includes(r.folder_id ?? ''),
                );
                if (
                    state.activeRequestId &&
                    !state.requests.find((r) => r.id === state.activeRequestId)
                ) {
                    state.activeRequestId = null;
                }
            });
            for (const envId of envIdsToRemove) envStore.deleteEnvironment(envId);
        },

        addFolder: (folder) =>
            set((state) => {
                state.folders.push(folder);
            }),

        renameFolder: (id, name) =>
            set((state) => {
                const folder = state.folders.find((f) => f.id === id);
                if (folder) folder.name = name;
            }),

        moveFolder: (id, parentId) =>
            set((state) => {
                const folder = state.folders.find((f) => f.id === id);
                if (folder) folder.parent_id = parentId;
            }),

        deleteFolder: (id) =>
            set((state) => {
                state.folders = state.folders.filter((f) => f.id !== id);
                state.requests = state.requests.filter((r) => r.folder_id !== id);
                if (
                    state.activeRequestId &&
                    !state.requests.find((r) => r.id === state.activeRequestId)
                ) {
                    state.activeRequestId = null;
                }
            }),

        addRequest: (request) =>
            set((state) => {
                state.requests.push(request);
            }),

        renameRequest: (id, name) =>
            set((state) => {
                const req = state.requests.find((r) => r.id === id);
                if (req) req.name = name;
            }),

        updateRequest: (id, changes) =>
            set((state) => {
                const req = state.requests.find((r) => r.id === id);
                if (req) Object.assign(req, changes);
            }),

        clearTemplateLinks: (templateId) =>
            set((state) => {
                for (const r of state.requests) {
                    if (r.pre_request_template_id === templateId) r.pre_request_template_id = null;
                }
            }),

        deleteRequest: (id) =>
            set((state) => {
                state.requests = state.requests.filter((r) => r.id !== id);
                if (state.activeRequestId === id) {
                    state.activeRequestId = null;
                }
            }),

        reorderFolders: (collectionId, orderedIds) =>
            set((state) => {
                orderedIds.forEach((fid, index) => {
                    const folder = state.folders.find(
                        (f) => f.id === fid && f.collection_id === collectionId,
                    );
                    if (folder) folder.sort_order = index;
                });
            }),

        reorderRequests: (collectionId, folderId, orderedIds) =>
            set((state) => {
                orderedIds.forEach((rid, index) => {
                    const req = state.requests.find(
                        (r) =>
                            r.id === rid &&
                            r.collection_id === collectionId &&
                            (folderId === null
                                ? r.folder_id === null
                                : r.folder_id === folderId),
                    );
                    if (req) req.sort_order = index;
                });
            }),

        getCollectionTree: () => {
            const { collections, folders, requests } = get();
            return collections.map((col) => {
                const colFolders = folders.filter((f) => f.collection_id === col.id);

                // Group this collection's folders by parent_id for recursive assembly.
                const childrenOf = new Map<string | null, Folder[]>();
                for (const f of colFolders) {
                    const list = childrenOf.get(f.parent_id) ?? [];
                    list.push(f);
                    childrenOf.set(f.parent_id, list);
                }

                const requestsOf = (folderId: string): TreeRequest[] =>
                    requests
                        .filter((r) => r.folder_id === folderId)
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((r): TreeRequest => ({ type: 'request', item: r }));

                // `seen` guards against cyclic parent_id chains (would otherwise recurse forever)
                // and against a folder being emitted twice.
                const seen = new Set<string>();
                const build = (parentId: string | null, depth: number): TreeFolder[] =>
                    (childrenOf.get(parentId) ?? [])
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .filter((f) => {
                            if (seen.has(f.id)) return false;
                            seen.add(f.id);
                            return true;
                        })
                        .map(
                            (folder): TreeFolder => ({
                                type: 'folder',
                                item: folder,
                                depth,
                                folders: build(folder.id, depth + 1),
                                requests: requestsOf(folder.id),
                            }),
                        );

                const topLevel = build(null, 0);

                // Orphans & cycle members: folders never reached from a root — either
                // their parent_id points at a missing folder, or they are trapped in a
                // parent_id cycle. Surface them at the top level instead of silently
                // dropping the user's data. Re-check `seen` inside the loop because each
                // build() emits descendants, so a later candidate may already be covered.
                const orphans: TreeFolder[] = [];
                for (const folder of colFolders
                    .filter((f) => f.parent_id !== null && !seen.has(f.id))
                    .sort((a, b) => a.sort_order - b.sort_order)) {
                    if (seen.has(folder.id)) continue;
                    seen.add(folder.id);
                    orphans.push({
                        type: 'folder',
                        item: folder,
                        depth: 0,
                        folders: build(folder.id, 1),
                        requests: requestsOf(folder.id),
                    });
                }

                const directRequests = requests
                    .filter((r) => r.collection_id === col.id && r.folder_id === null)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((r): TreeRequest => ({ type: 'request', item: r }));

                return {
                    type: 'collection' as const,
                    item: col,
                    folders: [...topLevel, ...orphans],
                    requests: directRequests,
                };
            });
        },
    })),
);

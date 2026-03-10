import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Collection, Folder, Request } from '@/lib/db';

// ─── Tree Types ───────────────────────────────────────────────────────────────

export interface TreeRequest {
    type: 'request';
    item: Request;
}

export interface TreeFolder {
    type: 'folder';
    item: Folder;
    children: TreeRequest[];
}

export interface TreeCollection {
    type: 'collection';
    item: Collection;
    folders: TreeFolder[];
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
    deleteCollection: (id: string) => void;

    // Folder CRUD
    addFolder: (folder: Folder) => void;
    renameFolder: (id: string, name: string) => void;
    deleteFolder: (id: string) => void;

    // Request CRUD
    addRequest: (request: Request) => void;
    renameRequest: (id: string, name: string) => void;
    deleteRequest: (id: string) => void;
    updateRequest: (id: string, changes: Partial<Omit<Request, 'id' | 'created_at'>>) => void;

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

        deleteCollection: (id) =>
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
                const colFolders = folders
                    .filter((f) => f.collection_id === col.id)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map(
                        (folder): TreeFolder => ({
                            type: 'folder',
                            item: folder,
                            children: requests
                                .filter((r) => r.folder_id === folder.id)
                                .sort((a, b) => a.sort_order - b.sort_order)
                                .map((r): TreeRequest => ({ type: 'request', item: r })),
                        }),
                    );

                const directRequests = requests
                    .filter((r) => r.collection_id === col.id && r.folder_id === null)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((r): TreeRequest => ({ type: 'request', item: r }));

                return {
                    type: 'collection' as const,
                    item: col,
                    folders: colFolders,
                    requests: directRequests,
                };
            });
        },
    })),
);

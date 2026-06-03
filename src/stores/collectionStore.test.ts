import { describe, it, expect, beforeEach } from 'vitest';
import { useCollectionStore } from './collectionStore';
import type { Collection, Folder, Request } from '@/lib/db';

const makeCol = (overrides: Partial<Collection> = {}): Collection => ({
    id: 'col-1',
    name: 'Test Collection',
    description: '',
    created_at: 'ts',
    updated_at: 'ts',
    ...overrides,
});

const makeFld = (overrides: Partial<Folder> = {}): Folder => ({
    id: 'fld-1',
    collection_id: 'col-1',
    parent_id: null,
    name: 'Folder A',
    sort_order: 0,
    created_at: 'ts',
    updated_at: 'ts',
    ...overrides,
});

const makeReq = (overrides: Partial<Request> = {}): Request => ({
    id: 'req-1',
    collection_id: 'col-1',
    folder_id: null,
    name: 'Get Users',
    method: 'GET',
    url: '',
    headers: [],
    query_params: [],
    body_type: 'none',
    body_content: '',
    auth_type: 'none',
    auth_config: {},
    pre_request_script: '',
    pre_request_script_enabled: true,
    sort_order: 0,
    created_at: 'ts',
    updated_at: 'ts',
    ...overrides,
});

const resetStore = () =>
    useCollectionStore.setState({
        collections: [],
        folders: [],
        requests: [],
        activeRequestId: null,
    });

describe('collectionStore', () => {
    beforeEach(resetStore);

    it('initializes with empty state', () => {
        const s = useCollectionStore.getState();
        expect(s.collections).toEqual([]);
        expect(s.folders).toEqual([]);
        expect(s.requests).toEqual([]);
        expect(s.activeRequestId).toBeNull();
    });

    it('loadAll replaces all data', () => {
        useCollectionStore.getState().loadAll([makeCol()], [makeFld()], [makeReq()]);
        const s = useCollectionStore.getState();
        expect(s.collections).toHaveLength(1);
        expect(s.folders).toHaveLength(1);
        expect(s.requests).toHaveLength(1);
    });

    it('setActiveRequest stores id', () => {
        useCollectionStore.getState().setActiveRequest('req-1');
        expect(useCollectionStore.getState().activeRequestId).toBe('req-1');
    });

    it('setActiveRequest accepts null', () => {
        useCollectionStore.getState().setActiveRequest('req-1');
        useCollectionStore.getState().setActiveRequest(null);
        expect(useCollectionStore.getState().activeRequestId).toBeNull();
    });

    describe('collection CRUD', () => {
        it('addCollection appends', () => {
            useCollectionStore.getState().addCollection(makeCol());
            expect(useCollectionStore.getState().collections).toHaveLength(1);
        });

        it('renameCollection updates name', () => {
            useCollectionStore.getState().addCollection(makeCol({ name: 'Old' }));
            useCollectionStore.getState().renameCollection('col-1', 'New Name');
            expect(useCollectionStore.getState().collections[0].name).toBe('New Name');
        });

        it('renameCollection is a noop when id not found', () => {
            useCollectionStore.getState().addCollection(makeCol());
            useCollectionStore.getState().renameCollection('nonexistent', 'New');
            expect(useCollectionStore.getState().collections[0].name).toBe('Test Collection');
        });

        it('deleteCollection removes collection, its folders, and all child requests', () => {
            const reqInFolder = makeReq({ id: 'req-1', folder_id: 'fld-1', collection_id: 'col-1' });
            const reqDirect = makeReq({ id: 'req-2', folder_id: null, collection_id: 'col-1' });
            useCollectionStore.getState().loadAll([makeCol()], [makeFld()], [reqInFolder, reqDirect]);
            useCollectionStore.getState().deleteCollection('col-1', []);
            const s = useCollectionStore.getState();
            expect(s.collections).toHaveLength(0);
            expect(s.folders).toHaveLength(0);
            expect(s.requests).toHaveLength(0);
        });

        it('deleteCollection clears activeRequestId when active request was in that collection', () => {
            useCollectionStore.getState().loadAll([makeCol()], [], [makeReq()]);
            useCollectionStore.getState().setActiveRequest('req-1');
            useCollectionStore.getState().deleteCollection('col-1', []);
            expect(useCollectionStore.getState().activeRequestId).toBeNull();
        });
    });

    describe('folder CRUD', () => {
        it('addFolder appends', () => {
            useCollectionStore.getState().addFolder(makeFld());
            expect(useCollectionStore.getState().folders).toHaveLength(1);
        });

        it('renameFolder updates name', () => {
            useCollectionStore.getState().addFolder(makeFld({ name: 'Old' }));
            useCollectionStore.getState().renameFolder('fld-1', 'Auth Flow');
            expect(useCollectionStore.getState().folders[0].name).toBe('Auth Flow');
        });

        it('deleteFolder removes folder and its child requests', () => {
            const reqInFld = makeReq({ id: 'req-1', folder_id: 'fld-1' });
            const reqOther = makeReq({ id: 'req-2', folder_id: null });
            useCollectionStore.getState().loadAll([makeCol()], [makeFld()], [reqInFld, reqOther]);
            useCollectionStore.getState().deleteFolder('fld-1');
            const s = useCollectionStore.getState();
            expect(s.folders).toHaveLength(0);
            expect(s.requests.find((r) => r.id === 'req-1')).toBeUndefined();
            expect(s.requests.find((r) => r.id === 'req-2')).toBeDefined();
        });

        it('deleteFolder clears activeRequestId when active request was in that folder', () => {
            useCollectionStore.getState().loadAll(
                [makeCol()],
                [makeFld()],
                [makeReq({ folder_id: 'fld-1' })],
            );
            useCollectionStore.getState().setActiveRequest('req-1');
            useCollectionStore.getState().deleteFolder('fld-1');
            expect(useCollectionStore.getState().activeRequestId).toBeNull();
        });
    });

    describe('request CRUD', () => {
        it('addRequest appends', () => {
            useCollectionStore.getState().addRequest(makeReq());
            expect(useCollectionStore.getState().requests).toHaveLength(1);
        });

        it('renameRequest updates name', () => {
            useCollectionStore.getState().addRequest(makeReq({ name: 'Old' }));
            useCollectionStore.getState().renameRequest('req-1', 'Updated');
            expect(useCollectionStore.getState().requests[0].name).toBe('Updated');
        });

        it('deleteRequest removes it', () => {
            useCollectionStore.getState().addRequest(makeReq());
            useCollectionStore.getState().deleteRequest('req-1');
            expect(useCollectionStore.getState().requests).toHaveLength(0);
        });

        it('deleteRequest clears activeRequestId when deleted request was active', () => {
            useCollectionStore.getState().addRequest(makeReq());
            useCollectionStore.getState().setActiveRequest('req-1');
            useCollectionStore.getState().deleteRequest('req-1');
            expect(useCollectionStore.getState().activeRequestId).toBeNull();
        });
    });

    describe('reorder', () => {
        it('reorderFolders updates sort_order in new position order', () => {
            const f1 = makeFld({ id: 'fld-1', sort_order: 0 });
            const f2 = makeFld({ id: 'fld-2', sort_order: 1 });
            useCollectionStore.getState().loadAll([], [f1, f2], []);
            useCollectionStore.getState().reorderFolders('col-1', ['fld-2', 'fld-1']);
            const s = useCollectionStore.getState();
            expect(s.folders.find((f) => f.id === 'fld-2')!.sort_order).toBe(0);
            expect(s.folders.find((f) => f.id === 'fld-1')!.sort_order).toBe(1);
        });

        it('reorderRequests updates sort_order in new position order', () => {
            const r1 = makeReq({ id: 'req-1', sort_order: 0 });
            const r2 = makeReq({ id: 'req-2', sort_order: 1 });
            useCollectionStore.getState().loadAll([], [], [r1, r2]);
            useCollectionStore.getState().reorderRequests('col-1', null, ['req-2', 'req-1']);
            const s = useCollectionStore.getState();
            expect(s.requests.find((r) => r.id === 'req-2')!.sort_order).toBe(0);
            expect(s.requests.find((r) => r.id === 'req-1')!.sort_order).toBe(1);
        });
    });

    describe('getCollectionTree', () => {
        it('returns empty array when no collections', () => {
            expect(useCollectionStore.getState().getCollectionTree()).toEqual([]);
        });

        it('builds structured tree with collection/folder/request hierarchy', () => {
            const col = makeCol({ id: 'col-1' });
            const fld = makeFld({ id: 'fld-1', collection_id: 'col-1' });
            const reqInFolder = makeReq({ id: 'req-1', folder_id: 'fld-1', collection_id: 'col-1' });
            const reqDirect = makeReq({ id: 'req-2', folder_id: null, collection_id: 'col-1' });
            useCollectionStore.getState().loadAll([col], [fld], [reqInFolder, reqDirect]);
            const tree = useCollectionStore.getState().getCollectionTree();
            expect(tree).toHaveLength(1);
            expect(tree[0].type).toBe('collection');
            expect(tree[0].item.id).toBe('col-1');
            expect(tree[0].folders).toHaveLength(1);
            expect(tree[0].folders[0].type).toBe('folder');
            expect(tree[0].folders[0].depth).toBe(0);
            expect(tree[0].folders[0].requests).toHaveLength(1);
            expect(tree[0].folders[0].folders).toHaveLength(0);
            expect(tree[0].requests).toHaveLength(1);
            expect(tree[0].requests[0].item.id).toBe('req-2');
        });

        it('orders folders and requests by sort_order ascending', () => {
            const col = makeCol();
            const f1 = makeFld({ id: 'fld-1', sort_order: 1 });
            const f2 = makeFld({ id: 'fld-2', sort_order: 0 });
            useCollectionStore.getState().loadAll([col], [f1, f2], []);
            const tree = useCollectionStore.getState().getCollectionTree();
            expect(tree[0].folders[0].item.id).toBe('fld-2');
            expect(tree[0].folders[1].item.id).toBe('fld-1');
        });

        it('only includes direct requests (folder_id null) at collection level', () => {
            const col = makeCol();
            const fld = makeFld();
            const reqInFld = makeReq({ id: 'req-1', folder_id: 'fld-1' });
            const reqDirect = makeReq({ id: 'req-2', folder_id: null });
            useCollectionStore.getState().loadAll([col], [fld], [reqInFld, reqDirect]);
            const tree = useCollectionStore.getState().getCollectionTree();
            expect(tree[0].requests).toHaveLength(1);
            expect(tree[0].requests[0].item.id).toBe('req-2');
        });

        it('builds a 5-level nested folder tree with correct depths', () => {
            const col = makeCol();
            // fld-0 (depth 0) → fld-1 (1) → fld-2 (2) → fld-3 (3) → fld-4 (4)
            const folders = [0, 1, 2, 3, 4].map((d) =>
                makeFld({
                    id: `fld-${d}`,
                    parent_id: d === 0 ? null : `fld-${d - 1}`,
                    name: `Level ${d}`,
                }),
            );
            // one request at the deepest folder
            const deepReq = makeReq({ id: 'req-deep', folder_id: 'fld-4' });
            useCollectionStore.getState().loadAll([col], folders, [deepReq]);
            const tree = useCollectionStore.getState().getCollectionTree();

            // Walk down the chain asserting depth + single child at each level
            let node = tree[0].folders[0];
            expect(tree[0].folders).toHaveLength(1);
            for (let d = 0; d < 4; d++) {
                expect(node.item.id).toBe(`fld-${d}`);
                expect(node.depth).toBe(d);
                expect(node.folders).toHaveLength(1);
                node = node.folders[0];
            }
            // deepest level (depth 4) holds the request, no further folders
            expect(node.item.id).toBe('fld-4');
            expect(node.depth).toBe(4);
            expect(node.folders).toHaveLength(0);
            expect(node.requests).toHaveLength(1);
            expect(node.requests[0].item.id).toBe('req-deep');
        });

        it('flat collection (all parent_id null) renders all folders at depth 0', () => {
            const col = makeCol();
            const flat = [0, 1, 2].map((i) =>
                makeFld({ id: `fld-${i}`, parent_id: null, sort_order: i }),
            );
            useCollectionStore.getState().loadAll([col], flat, []);
            const tree = useCollectionStore.getState().getCollectionTree();
            expect(tree[0].folders).toHaveLength(3);
            for (const f of tree[0].folders) {
                expect(f.depth).toBe(0);
                expect(f.folders).toHaveLength(0);
            }
        });

        it('orphan folder (parent_id points at missing folder) surfaces at top level', () => {
            const col = makeCol();
            const orphan = makeFld({ id: 'fld-orphan', parent_id: 'does-not-exist' });
            useCollectionStore.getState().loadAll([col], [orphan], []);
            const tree = useCollectionStore.getState().getCollectionTree();
            expect(tree[0].folders).toHaveLength(1);
            expect(tree[0].folders[0].item.id).toBe('fld-orphan');
            expect(tree[0].folders[0].depth).toBe(0);
        });

        it('cyclic parent_id chain surfaces the folders instead of dropping them', () => {
            const col = makeCol();
            // a → b → a (cycle); neither is reachable from null and both reference existing folders
            const a = makeFld({ id: 'fld-a', parent_id: 'fld-b', sort_order: 0 });
            const b = makeFld({ id: 'fld-b', parent_id: 'fld-a', sort_order: 1 });
            const reqInB = makeReq({ id: 'req-b', folder_id: 'fld-b' });
            useCollectionStore.getState().loadAll([col], [a, b], [reqInB]);
            // Returns without hanging AND the user's data is not silently lost: one
            // cycle member surfaces at the top level with the other nested under it.
            const tree = useCollectionStore.getState().getCollectionTree();
            expect(tree[0].folders).toHaveLength(1);
            const top = tree[0].folders[0];
            expect(top.item.id).toBe('fld-a');
            expect(top.folders).toHaveLength(1);
            expect(top.folders[0].item.id).toBe('fld-b');
            expect(top.folders[0].requests[0].item.id).toBe('req-b');
        });
    });
});

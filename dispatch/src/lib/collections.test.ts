import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
    execute: vi.fn(),
    select: vi.fn(),
};

vi.mock('@/lib/db', () => ({
    getDb: vi.fn().mockResolvedValue(mockDb),
}));

describe('collections lib', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.execute.mockResolvedValue({});
        mockDb.select.mockResolvedValue([]);
    });

    describe('loadAllCollections', () => {
        it('fetches collections, folders, and deserializes requests from DB', async () => {
            mockDb.select
                .mockResolvedValueOnce([
                    { id: 'c1', name: 'My API', description: '', created_at: '', updated_at: '' },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'f1',
                        collection_id: 'c1',
                        parent_id: null,
                        name: 'Auth',
                        sort_order: 0,
                        created_at: '',
                        updated_at: '',
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'r1',
                        collection_id: 'c1',
                        folder_id: null,
                        name: 'List',
                        method: 'GET',
                        url: '',
                        sort_order: 0,
                        headers: '[]',
                        query_params: '[]',
                        body_type: 'none',
                        body_content: '',
                        auth_type: 'none',
                        auth_config: '{}',
                        created_at: '',
                        updated_at: '',
                    },
                ]);
            const { loadAllCollections } = await import('./collections');
            const result = await loadAllCollections();
            expect(result.collections).toHaveLength(1);
            expect(result.folders).toHaveLength(1);
            expect(result.requests).toHaveLength(1);
            expect(result.requests[0].headers).toEqual([]);
            expect(result.requests[0].auth_config).toEqual({});
            expect(result.requests[0].sort_order).toBe(0);
        });
    });

    describe('createCollection', () => {
        it('inserts collection into DB and returns it', async () => {
            const { createCollection } = await import('./collections');
            const result = await createCollection('Test API');
            expect(result.name).toBe('Test API');
            expect(typeof result.id).toBe('string');
            expect(mockDb.execute).toHaveBeenCalledOnce();
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO collections'),
                expect.any(Array),
            );
        });
    });

    describe('renameCollection', () => {
        it('calls UPDATE SQL with new name and id', async () => {
            const { renameCollection } = await import('./collections');
            await renameCollection('c1', 'Updated Name');
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE collections'),
                expect.arrayContaining(['Updated Name', 'c1']),
            );
        });
    });

    describe('deleteCollection', () => {
        it('calls DELETE SQL with id', async () => {
            const { deleteCollection } = await import('./collections');
            await deleteCollection('c1');
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM collections'),
                expect.arrayContaining(['c1']),
            );
        });
    });

    describe('createFolder', () => {
        it('inserts folder and returns it with correct collection_id', async () => {
            const { createFolder } = await import('./collections');
            const result = await createFolder('c1', 'Auth Folder', null);
            expect(result.name).toBe('Auth Folder');
            expect(result.collection_id).toBe('c1');
            expect(result.parent_id).toBeNull();
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO folders'),
                expect.any(Array),
            );
        });
    });

    describe('updateFolderOrder', () => {
        it('calls UPDATE folders SET sort_order with correct values', async () => {
            const { updateFolderOrder } = await import('./collections');
            await updateFolderOrder('f1', 3);
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE folders SET sort_order'),
                expect.arrayContaining([3, 'f1']),
            );
        });
    });

    describe('createSavedRequest', () => {
        it('inserts request and returns it with correct collection_id', async () => {
            const { createSavedRequest } = await import('./collections');
            const result = await createSavedRequest('c1', 'New Request', null);
            expect(result.name).toBe('New Request');
            expect(result.collection_id).toBe('c1');
            expect(result.folder_id).toBeNull();
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO requests'),
                expect.any(Array),
            );
        });
    });

    describe('renameRequest', () => {
        it('calls UPDATE requests SQL with new name and id', async () => {
            const { renameRequest } = await import('./collections');
            await renameRequest('r1', 'Updated');
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE requests'),
                expect.arrayContaining(['Updated', 'r1']),
            );
        });
    });

    describe('updateRequestOrder', () => {
        it('calls UPDATE requests SET sort_order with correct values', async () => {
            const { updateRequestOrder } = await import('./collections');
            await updateRequestOrder('r1', 2);
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE requests SET sort_order'),
                expect.arrayContaining([2, 'r1']),
            );
        });
    });
});

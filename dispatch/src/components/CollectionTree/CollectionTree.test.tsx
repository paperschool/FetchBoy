import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Collection, Folder, Request } from '@/lib/db';
import { useCollectionStore } from '@/stores/collectionStore';
import { CollectionTree } from './CollectionTree';

// ─── Mock collections lib ─────────────────────────────────────────────────────
const mockLoadAllCollections = vi.fn();
const mockCreateCollection = vi.fn();
const mockRenameCollection = vi.fn();
const mockDeleteCollection = vi.fn();
const mockCreateFolder = vi.fn();
const mockRenameFolder = vi.fn();
const mockDeleteFolder = vi.fn();
const mockCreateSavedRequest = vi.fn();
const mockRenameRequest = vi.fn();
const mockDeleteRequest = vi.fn();
const mockUpdateFolderOrder = vi.fn();
const mockUpdateRequestOrder = vi.fn();

vi.mock('@/lib/collections', () => ({
    loadAllCollections: () => mockLoadAllCollections(),
    createCollection: (...a: unknown[]) => mockCreateCollection(...a),
    renameCollection: (...a: unknown[]) => mockRenameCollection(...a),
    deleteCollection: (...a: unknown[]) => mockDeleteCollection(...a),
    createFolder: (...a: unknown[]) => mockCreateFolder(...a),
    renameFolder: (...a: unknown[]) => mockRenameFolder(...a),
    deleteFolder: (...a: unknown[]) => mockDeleteFolder(...a),
    createSavedRequest: (...a: unknown[]) => mockCreateSavedRequest(...a),
    renameRequest: (...a: unknown[]) => mockRenameRequest(...a),
    deleteRequest: (...a: unknown[]) => mockDeleteRequest(...a),
    updateFolderOrder: (...a: unknown[]) => mockUpdateFolderOrder(...a),
    updateRequestOrder: (...a: unknown[]) => mockUpdateRequestOrder(...a),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const makeCol = (o: Partial<Collection> = {}): Collection => ({
    id: 'col-1',
    name: 'My API',
    description: '',
    created_at: '',
    updated_at: '',
    ...o,
});

const makeFld = (o: Partial<Folder> = {}): Folder => ({
    id: 'fld-1',
    collection_id: 'col-1',
    parent_id: null,
    name: 'Auth',
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...o,
});

const makeReq = (o: Partial<Request> = {}): Request => ({
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
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...o,
});

// Reset store before each test
const resetStore = () =>
    useCollectionStore.setState({
        collections: [],
        folders: [],
        requests: [],
        activeRequestId: null,
    });

describe('CollectionTree', () => {
    beforeEach(() => {
        resetStore();
        vi.clearAllMocks();
        mockLoadAllCollections.mockResolvedValue({ collections: [], folders: [], requests: [] });
        mockCreateCollection.mockResolvedValue(makeCol());
        mockDeleteCollection.mockResolvedValue(undefined);
        mockCreateFolder.mockResolvedValue(makeFld());
        mockDeleteFolder.mockResolvedValue(undefined);
        mockCreateSavedRequest.mockResolvedValue(makeReq());
        mockDeleteRequest.mockResolvedValue(undefined);
        mockUpdateFolderOrder.mockResolvedValue(undefined);
        mockUpdateRequestOrder.mockResolvedValue(undefined);
    });

    it('shows empty state when no collections', async () => {
        render(<CollectionTree />);
        await waitFor(() => {
            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        });
    });

    it('renders the collection tree container', async () => {
        render(<CollectionTree />);
        expect(screen.getByTestId('collection-tree')).toBeInTheDocument();
        // flush useEffect async load
        await waitFor(() => {});
    });

    it('shows an Add Collection button', async () => {
        render(<CollectionTree />);
        expect(screen.getByLabelText('Add Collection')).toBeInTheDocument();
        await waitFor(() => {});
    });

    it('calls loadAllCollections on mount and populates tree nodes', async () => {
        const col = makeCol();
        mockLoadAllCollections.mockResolvedValue({ collections: [col], folders: [], requests: [] });
        render(<CollectionTree />);
        await waitFor(() => {
            expect(screen.getByTestId('collection-col-1')).toBeInTheDocument();
        });
        expect(mockLoadAllCollections).toHaveBeenCalledOnce();
    });

    it('does not show empty state when collections are present', async () => {
        mockLoadAllCollections.mockResolvedValue({
            collections: [makeCol()],
            folders: [],
            requests: [],
        });
        render(<CollectionTree />);
        await waitFor(() => {
            expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
        });
    });

    it('expands a collection to reveal its children', async () => {
        const col = makeCol();
        const fld = makeFld();
        mockLoadAllCollections.mockResolvedValue({
            collections: [col],
            folders: [fld],
            requests: [],
        });
        render(<CollectionTree />);
        await waitFor(() => screen.getByTestId('collection-col-1'));
        fireEvent.click(screen.getByLabelText('Expand collection'));
        await waitFor(() => {
            expect(screen.getByTestId('folder-fld-1')).toBeInTheDocument();
        });
    });

    it('expands a folder to reveal its requests', async () => {
        const col = makeCol();
        const fld = makeFld();
        const req = makeReq({ folder_id: 'fld-1' });
        mockLoadAllCollections.mockResolvedValue({
            collections: [col],
            folders: [fld],
            requests: [req],
        });
        render(<CollectionTree />);
        await waitFor(() => screen.getByTestId('collection-col-1'));
        fireEvent.click(screen.getByLabelText('Expand collection'));
        await waitFor(() => screen.getByTestId('folder-fld-1'));
        fireEvent.click(screen.getByLabelText('Expand folder'));
        await waitFor(() => {
            expect(screen.getByTestId('request-req-1')).toBeInTheDocument();
        });
    });

    it('direct collection requests (no folder) are visible when collection is expanded', async () => {
        const col = makeCol();
        const req = makeReq({ folder_id: null });
        mockLoadAllCollections.mockResolvedValue({
            collections: [col],
            folders: [],
            requests: [req],
        });
        render(<CollectionTree />);
        await waitFor(() => screen.getByTestId('collection-col-1'));
        fireEvent.click(screen.getByLabelText('Expand collection'));
        await waitFor(() => {
            expect(screen.getByTestId('request-req-1')).toBeInTheDocument();
        });
    });

    it('clicking a request sets it as the active request in the store', async () => {
        const col = makeCol();
        const req = makeReq({ folder_id: null });
        mockLoadAllCollections.mockResolvedValue({
            collections: [col],
            folders: [],
            requests: [req],
        });
        render(<CollectionTree />);
        await waitFor(() => screen.getByTestId('collection-col-1'));
        fireEvent.click(screen.getByLabelText('Expand collection'));
        await waitFor(() => screen.getByTestId('request-req-1'));
        fireEvent.click(screen.getByTestId('request-req-1'));
        expect(useCollectionStore.getState().activeRequestId).toBe('req-1');
    });

    it('active request row has data-active="true"', async () => {
        const col = makeCol();
        const req = makeReq({ folder_id: null });
        mockLoadAllCollections.mockResolvedValue({
            collections: [col],
            folders: [],
            requests: [req],
        });
        render(<CollectionTree />);
        await waitFor(() => screen.getByTestId('collection-col-1'));
        fireEvent.click(screen.getByLabelText('Expand collection'));
        await waitFor(() => screen.getByTestId('request-req-1'));
        fireEvent.click(screen.getByTestId('request-req-1'));
        await waitFor(() => {
            expect(screen.getByTestId('request-req-1')).toHaveAttribute('data-active', 'true');
        });
    });

    it('add collection button triggers createCollection and adds to store', async () => {
        const newCol = makeCol({ id: 'col-new', name: 'New Collection' });
        mockCreateCollection.mockResolvedValue(newCol);
        render(<CollectionTree />);
        await waitFor(() => screen.getByTestId('empty-state'));
        fireEvent.click(screen.getByLabelText('Add Collection'));
        await waitFor(() => {
            expect(mockCreateCollection).toHaveBeenCalledWith('New Collection');
            expect(useCollectionStore.getState().collections).toHaveLength(1);
        });
    });

    it('delete collection calls deleteCollection lib and removes from store', async () => {
        const col = makeCol();
        mockLoadAllCollections.mockResolvedValue({
            collections: [col],
            folders: [],
            requests: [],
        });
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        render(<CollectionTree />);
        await waitFor(() => screen.getByTestId('collection-col-1'));
        fireEvent.click(screen.getByLabelText('Delete collection'));
        await waitFor(() => {
            expect(mockDeleteCollection).toHaveBeenCalledWith('col-1');
            expect(useCollectionStore.getState().collections).toHaveLength(0);
        });
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedSampleDataIfNeeded } from './seedSampleData';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { mockDb } = vi.hoisted(() => {
    const mockDb = {
        execute: vi.fn(),
        select: vi.fn(),
    };
    return { mockDb };
});

vi.mock('@/lib/db', () => ({
    getDb: () => Promise.resolve(mockDb),
}));

// ─── Store mocks ──────────────────────────────────────────────────────────────

const addCollectionMock = vi.fn();
const addFolderMock = vi.fn();
const addRequestMock = vi.fn();
let collectionStoreMockCollections: { id: string }[] = [];

vi.mock('@/stores/collectionStore', () => ({
    useCollectionStore: {
        getState: () => ({
            collections: collectionStoreMockCollections,
            addCollection: addCollectionMock,
            addFolder: addFolderMock,
            addRequest: addRequestMock,
        }),
    },
}));

let hasSeededSampleData = false;
const setHasSeededSampleDataMock = vi.fn((val: boolean) => {
    hasSeededSampleData = val;
});

vi.mock('@/stores/uiSettingsStore', () => ({
    useUiSettingsStore: {
        getState: () => ({
            get hasSeededSampleData() {
                return hasSeededSampleData;
            },
            setHasSeededSampleData: setHasSeededSampleDataMock,
        }),
    },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('seedSampleDataIfNeeded', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hasSeededSampleData = false;
        collectionStoreMockCollections = [];
        mockDb.execute.mockResolvedValue(undefined);
    });

    it('does nothing if already seeded', async () => {
        hasSeededSampleData = true;

        await seedSampleDataIfNeeded();

        expect(addCollectionMock).not.toHaveBeenCalled();
        expect(addRequestMock).not.toHaveBeenCalled();
        expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('creates the Getting Started collection if not seeded', async () => {
        await seedSampleDataIfNeeded();

        expect(addCollectionMock).toHaveBeenCalledOnce();
        const addedCollection = addCollectionMock.mock.calls[0][0] as { id: string; name: string };
        expect(addedCollection.id).toBe('sample-getting-started');
        expect(addedCollection.name).toBe('Example Requests');
    });

    it('creates 19 sample requests', async () => {
        await seedSampleDataIfNeeded();

        expect(addRequestMock).toHaveBeenCalledTimes(19);
    });

    it('sets hasSeededSampleData to true after seeding', async () => {
        await seedSampleDataIfNeeded();

        expect(setHasSeededSampleDataMock).toHaveBeenCalledWith(true);
        expect(hasSeededSampleData).toBe(true);
    });

    it('does not duplicate if collection already exists in store', async () => {
        collectionStoreMockCollections = [{ id: 'sample-getting-started' }];

        await seedSampleDataIfNeeded();

        expect(addCollectionMock).not.toHaveBeenCalled();
        expect(addRequestMock).not.toHaveBeenCalled();
        expect(setHasSeededSampleDataMock).toHaveBeenCalledWith(true);
    });

    it('writes collection to DB when seeding', async () => {
        await seedSampleDataIfNeeded();

        const insertCollectionCall = mockDb.execute.mock.calls.find(
            (call: unknown[]) =>
                typeof call[0] === 'string' && call[0].includes('INSERT INTO collections'),
        );
        expect(insertCollectionCall).toBeDefined();
    });

    it('writes 19 requests to DB when seeding', async () => {
        await seedSampleDataIfNeeded();

        const insertRequestCalls = mockDb.execute.mock.calls.filter(
            (call: unknown[]) =>
                typeof call[0] === 'string' && call[0].includes('INSERT INTO requests'),
        );
        expect(insertRequestCalls).toHaveLength(19);
    });

    it('persists has_seeded_sample_data flag to DB', async () => {
        await seedSampleDataIfNeeded();

        const flagCall = mockDb.execute.mock.calls.find(
            (call: unknown[]) =>
                Array.isArray(call[1]) && (call[1] as string[])[0] === 'has_seeded_sample_data',
        );
        expect(flagCall).toBeDefined();
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock must be defined before importing the module under test
const mockDb = { execute: vi.fn(), select: vi.fn() };
const mockLoad = vi.fn();

vi.mock('@tauri-apps/plugin-sql', () => ({
    default: { load: mockLoad },
}));

describe('db module', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        mockLoad.mockResolvedValue(mockDb);
    });

    it('getDb() resolves to a Database instance', async () => {
        const { getDb } = await import('./db');
        const db = await getDb();
        expect(db).toBe(mockDb);
        expect(mockLoad).toHaveBeenCalledOnce();
        expect(mockLoad).toHaveBeenCalledWith('sqlite:dispatch.db');
    });

    it('getDb() returns the same instance on repeated calls (singleton)', async () => {
        const { getDb } = await import('./db');
        const db1 = await getDb();
        const db2 = await getDb();
        expect(db1).toBe(db2);
        // Database.load must only be called once
        expect(mockLoad).toHaveBeenCalledOnce();
    });

    it('getDb() rejects and propagates the error when Database.load throws', async () => {
        mockLoad.mockRejectedValueOnce(new Error('DB unavailable'));
        const { getDb } = await import('./db');
        await expect(getDb()).rejects.toThrow('DB unavailable');
    });

    it('DB_PATH constant equals sqlite:dispatch.db', async () => {
        const { DB_PATH } = await import('./db');
        expect(DB_PATH).toBe('sqlite:dispatch.db');
    });
});

describe('TypeScript interface structural checks', () => {
    it('KeyValuePair has key, value, enabled fields', async () => {
        const { } = await import('./db');
        // Compile-time check — if this file compiles, the interfaces are valid.
        // We use a type assertion test to confirm required fields exist.
        const kv: import('./db').KeyValuePair = { key: 'k', value: 'v', enabled: true };
        expect(kv.key).toBe('k');
        expect(kv.value).toBe('v');
        expect(kv.enabled).toBe(true);
    });

    it('Request interface has all required fields including JSON array columns', async () => {
        const req: import('./db').Request = {
            id: 'uuid',
            collection_id: null,
            folder_id: null,
            name: 'My Request',
            method: 'GET',
            url: 'https://example.com',
            headers: [],
            query_params: [],
            body_type: 'none',
            body_content: '',
            auth_type: 'none',
            auth_config: {},
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
        };
        expect(req.method).toBe('GET');
    });

    it('Environment interface uses boolean for is_active', async () => {
        const env: import('./db').Environment = {
            id: 'uuid',
            name: 'Development',
            variables: [],
            is_active: false,
            created_at: '2026-01-01T00:00:00Z',
        };
        expect(typeof env.is_active).toBe('boolean');
    });
});

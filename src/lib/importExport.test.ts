import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Collection, Environment, Folder, Request } from '@/lib/db';

// ─── DB Mock ──────────────────────────────────────────────────────────────────

const mockExecute = vi.fn().mockResolvedValue(undefined);
const mockSelect = vi.fn();
const mockDb = { execute: mockExecute, select: mockSelect };

vi.mock('@/lib/db', () => ({
    getDb: vi.fn().mockResolvedValue(mockDb),
}));

beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeCollection = (overrides: Partial<Collection> = {}): Collection => ({
    id: 'col-original-id',
    name: 'My API',
    description: '',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

const makeFolder = (overrides: Partial<Folder> = {}): Folder => ({
    id: 'folder-original-id',
    collection_id: 'col-original-id',
    parent_id: null,
    name: 'Auth',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

const makeRequest = (overrides: Partial<Request> = {}): Request => ({
    id: 'req-original-id',
    collection_id: 'col-original-id',
    folder_id: 'folder-original-id',
    name: 'Login',
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
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

const makeEnvironment = (overrides: Partial<Environment> = {}): Environment => ({
    id: 'env-original-id',
    name: 'Production',
    variables: [{ key: 'BASE_URL', value: 'https://api.example.com', enabled: true }],
    is_active: false,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

// ─── exportCollectionToJson ───────────────────────────────────────────────────

describe('exportCollectionToJson', () => {
    it('returns valid JSON with correct envelope fields', async () => {
        const { exportCollectionToJson } = await import('./importExport');
        const col = makeCollection();
        const folder = makeFolder();
        const req1 = makeRequest({ id: 'r1' });
        const req2 = makeRequest({ id: 'r2' });
        const req3 = makeRequest({ id: 'r3' });
        const store = { collections: [col], folders: [folder], requests: [req1, req2, req3] };

        const json = exportCollectionToJson('col-original-id', store, []);
        const parsed = JSON.parse(json) as Record<string, unknown>;

        expect(parsed.fetch_boy_version).toBe('1.0');
        expect(parsed.type).toBe('collection');
        expect(typeof parsed.exported_at).toBe('string');
        expect(parsed.collection).toMatchObject({ id: 'col-original-id', name: 'My API' });
        expect(Array.isArray(parsed.folders)).toBe(true);
        expect((parsed.folders as unknown[]).length).toBe(1);
        expect(Array.isArray(parsed.requests)).toBe(true);
        expect((parsed.requests as unknown[]).length).toBe(3);
    });

    it('includes environment variables when collection has a default environment', async () => {
        const { exportCollectionToJson } = await import('./importExport');
        const col = makeCollection({ default_environment_id: 'env-1' });
        const env = makeEnvironment({ id: 'env-1' });
        const store = { collections: [col], folders: [], requests: [] };

        const json = exportCollectionToJson('col-original-id', store, [env]);
        const parsed = JSON.parse(json) as { environment?: { variables: unknown[] } };

        expect(parsed.environment).toBeDefined();
        expect(parsed.environment!.variables).toHaveLength(1);
    });

    it('redacts secret variable values on export', async () => {
        const { exportCollectionToJson } = await import('./importExport');
        const col = makeCollection({ default_environment_id: 'env-1' });
        const env = makeEnvironment({
            id: 'env-1',
            variables: [
                { key: 'BASE_URL', value: 'https://api.example.com', enabled: true },
                { key: 'API_KEY', value: 'super-secret-key', enabled: true, secret: true },
            ],
        });
        const store = { collections: [col], folders: [], requests: [] };

        const json = exportCollectionToJson('col-original-id', store, [env]);
        const parsed = JSON.parse(json) as { environment: { variables: Array<{ key: string; value: string; secret?: boolean }> } };

        const baseUrl = parsed.environment.variables.find((v) => v.key === 'BASE_URL')!;
        const apiKey = parsed.environment.variables.find((v) => v.key === 'API_KEY')!;
        expect(baseUrl.value).toBe('https://api.example.com');
        expect(apiKey.value).toBe('<REDACTED>');
    });

    it('omits environment when collection has no default environment', async () => {
        const { exportCollectionToJson } = await import('./importExport');
        const col = makeCollection({ default_environment_id: null });
        const store = { collections: [col], folders: [], requests: [] };

        const json = exportCollectionToJson('col-original-id', store, []);
        const parsed = JSON.parse(json) as { environment?: unknown };

        expect(parsed.environment).toBeUndefined();
    });

    it('filters to only the requested collection folders and requests', async () => {
        const { exportCollectionToJson } = await import('./importExport');
        const col1 = makeCollection({ id: 'c1' });
        const col2 = makeCollection({ id: 'c2', name: 'Other API' });
        const folder1 = makeFolder({ id: 'f1', collection_id: 'c1' });
        const folder2 = makeFolder({ id: 'f2', collection_id: 'c2' });
        const req1 = makeRequest({ id: 'r1', collection_id: 'c1', folder_id: 'f1' });
        const req2 = makeRequest({ id: 'r2', collection_id: 'c2', folder_id: 'f2' });
        const store = { collections: [col1, col2], folders: [folder1, folder2], requests: [req1, req2] };

        const json = exportCollectionToJson('c1', store, []);
        const parsed = JSON.parse(json) as { folders: Folder[]; requests: Request[] };

        expect(parsed.folders).toHaveLength(1);
        expect(parsed.folders[0].id).toBe('f1');
        expect(parsed.requests).toHaveLength(1);
        expect(parsed.requests[0].id).toBe('r1');
    });

    it('throws if collectionId not found in store', async () => {
        const { exportCollectionToJson } = await import('./importExport');
        const store = { collections: [], folders: [], requests: [] };
        expect(() => exportCollectionToJson('missing-id', store, [])).toThrow('Collection not found');
    });
});

// ─── exportEnvironmentToJson ──────────────────────────────────────────────────

describe('exportEnvironmentToJson', () => {
    it('returns valid JSON with correct envelope fields', async () => {
        const { exportEnvironmentToJson } = await import('./importExport');
        const env = makeEnvironment();

        const json = exportEnvironmentToJson('env-original-id', [env]);
        const parsed = JSON.parse(json) as Record<string, unknown>;

        expect(parsed.fetch_boy_version).toBe('1.0');
        expect(parsed.type).toBe('environment');
        expect(typeof parsed.exported_at).toBe('string');
        expect((parsed.environment as Environment).name).toBe('Production');
    });

    it('throws if environment not found', async () => {
        const { exportEnvironmentToJson } = await import('./importExport');
        expect(() => exportEnvironmentToJson('missing', [])).toThrow('Environment not found');
    });
});

// ─── importCollectionFromJson ─────────────────────────────────────────────────

describe('importCollectionFromJson', () => {
    const buildCollectionJson = (overrides: Record<string, unknown> = {}) => {
        const col = makeCollection();
        const folder = makeFolder();
        const req = makeRequest();
        return JSON.stringify({
            fetch_boy_version: '1.0',
            type: 'collection',
            exported_at: '2026-01-01T00:00:00.000Z',
            collection: col,
            folders: [folder],
            requests: [req],
            ...overrides,
        });
    };

    it('returns objects with new UUIDs different from originals', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        const { collection, folders, requests } = await importCollectionFromJson(buildCollectionJson());

        expect(collection.id).not.toBe('col-original-id');
        expect(folders[0].id).not.toBe('folder-original-id');
        expect(requests[0].id).not.toBe('req-original-id');
    });

    it('sets collection_id on all folders and requests to new collection ID', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        const { collection, folders, requests } = await importCollectionFromJson(buildCollectionJson());

        expect(folders[0].collection_id).toBe(collection.id);
        expect(requests[0].collection_id).toBe(collection.id);
    });

    it('remaps folder_id on requests from old to new IDs', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        const { folders, requests } = await importCollectionFromJson(buildCollectionJson());

        expect(requests[0].folder_id).toBe(folders[0].id);
        expect(requests[0].folder_id).not.toBe('folder-original-id');
    });

    it('remaps parent_id on nested folders', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        const parentFolder = makeFolder({ id: 'parent-folder' });
        const childFolder = makeFolder({ id: 'child-folder', parent_id: 'parent-folder' });
        const json = JSON.stringify({
            fetch_boy_version: '1.0',
            type: 'collection',
            exported_at: '2026-01-01T00:00:00.000Z',
            collection: makeCollection(),
            folders: [parentFolder, childFolder],
            requests: [],
        });
        const { folders } = await importCollectionFromJson(json);

        const newParent = folders.find((f) => f.name === 'Auth' && f.parent_id === null);
        const newChild = folders.find((f) => f.parent_id !== null);
        expect(newParent).toBeDefined();
        expect(newChild).toBeDefined();
        expect(newChild!.parent_id).toBe(newParent!.id);
    });

    it('calls DB execute: 1 collection + 1 batch folders + 1 batch requests', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        await importCollectionFromJson(buildCollectionJson());

        // 1 collection + 1 batch folder insert + 1 batch request insert = 3 calls
        expect(mockExecute).toHaveBeenCalledTimes(3);
    });

    it('collection INSERT includes the new collection ID', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        const { collection } = await importCollectionFromJson(buildCollectionJson());

        const collectionCall = mockExecute.mock.calls[0] as [string, unknown[]];
        expect(collectionCall[0]).toContain('INSERT INTO collections');
        expect(collectionCall[1]).toContain(collection.id);
    });

    it('creates environment and links it when envelope has variables', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        const json = buildCollectionJson({
            environment: {
                variables: [{ key: 'base_url', value: 'https://api.example.com', enabled: true }],
            },
        });
        const { collection, environment } = await importCollectionFromJson(json);

        expect(environment).not.toBeNull();
        expect(environment!.name).toBe('My API Variables');
        expect(environment!.variables).toHaveLength(1);
        expect(collection.default_environment_id).toBe(environment!.id);
        // Extra DB call for environment insert
        expect(mockExecute).toHaveBeenCalledTimes(4);
    });

    it('returns null environment when envelope has no variables', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        const { environment } = await importCollectionFromJson(buildCollectionJson());
        expect(environment).toBeNull();
    });

    it('throws "Invalid JSON" if json is malformed', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        await expect(importCollectionFromJson('not json')).rejects.toThrow('Invalid JSON: cannot parse file');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('throws on wrong type field with descriptive message', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        const json = buildCollectionJson({ type: 'environment' });
        await expect(importCollectionFromJson(json)).rejects.toThrow('Wrong file type: expected collection, got environment');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('throws on missing collection.name', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        const json = buildCollectionJson({ collection: { id: 'x', name: '' } });
        await expect(importCollectionFromJson(json)).rejects.toThrow('Missing required field: collection.name');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('throws on wrong fetch_boy_version', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        const json = buildCollectionJson({ fetch_boy_version: '2.0' });
        await expect(importCollectionFromJson(json)).rejects.toThrow('Unsupported format version: expected 1.0');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('makes no DB calls when validation fails (no partial writes)', async () => {
        const { importCollectionFromJson } = await import('./importExport');
        await expect(importCollectionFromJson('invalid')).rejects.toThrow();
        expect(mockExecute).not.toHaveBeenCalled();
    });
});

// ─── importEnvironmentFromJson ────────────────────────────────────────────────

describe('importEnvironmentFromJson', () => {
    const buildEnvJson = (overrides: Record<string, unknown> = {}) => {
        return JSON.stringify({
            fetch_boy_version: '1.0',
            type: 'environment',
            exported_at: '2026-01-01T00:00:00.000Z',
            environment: makeEnvironment(),
            ...overrides,
        });
    };

    it('returns environment with new UUID and is_active false', async () => {
        const { importEnvironmentFromJson } = await import('./importExport');
        const env = await importEnvironmentFromJson(buildEnvJson());

        expect(env.id).not.toBe('env-original-id');
        expect(env.is_active).toBe(false);
        expect(env.name).toBe('Production');
    });

    it('calls DB execute once', async () => {
        const { importEnvironmentFromJson } = await import('./importExport');
        await importEnvironmentFromJson(buildEnvJson());
        expect(mockExecute).toHaveBeenCalledOnce();
    });

    it('throws on invalid JSON', async () => {
        const { importEnvironmentFromJson } = await import('./importExport');
        await expect(importEnvironmentFromJson('bad')).rejects.toThrow('Invalid JSON: cannot parse file');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('throws on missing environment.name', async () => {
        const { importEnvironmentFromJson } = await import('./importExport');
        const json = buildEnvJson({ environment: { id: 'x', name: '' } });
        await expect(importEnvironmentFromJson(json)).rejects.toThrow('Missing required field: environment.name');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('makes no DB calls when validation fails', async () => {
        const { importEnvironmentFromJson } = await import('./importExport');
        await expect(importEnvironmentFromJson('{}')).rejects.toThrow();
        expect(mockExecute).not.toHaveBeenCalled();
    });
});

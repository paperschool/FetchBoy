import type { Collection, Environment, Folder, Request } from '@/lib/db';
import { insertOne, withTransaction } from '@/lib/dbHelpers';

// ─── Export Envelope Interfaces ───────────────────────────────────────────────

export interface CollectionExport {
    fetch_boy_version: '1.0';
    type: 'collection';
    exported_at: string;
    collection: Collection;
    folders: Folder[];
    requests: Request[];
}

export interface EnvironmentExport {
    fetch_boy_version: '1.0';
    type: 'environment';
    exported_at: string;
    environment: Environment;
}

// ─── Export Functions (pure — no DB) ─────────────────────────────────────────

export function exportCollectionToJson(
    collectionId: string,
    store: { collections: Collection[]; folders: Folder[]; requests: Request[] },
): string {
    const collection = store.collections.find((c) => c.id === collectionId);
    if (!collection) throw new Error('Collection not found');

    const folders = store.folders.filter((f) => f.collection_id === collectionId);
    const requests = store.requests.filter((r) => r.collection_id === collectionId);

    const envelope: CollectionExport = {
        fetch_boy_version: '1.0',
        type: 'collection',
        exported_at: new Date().toISOString(),
        collection,
        folders,
        requests,
    };

    return JSON.stringify(envelope, null, 2);
}

export function exportEnvironmentToJson(environmentId: string, environments: Environment[]): string {
    const environment = environments.find((e) => e.id === environmentId);
    if (!environment) throw new Error('Environment not found');

    const envelope: EnvironmentExport = {
        fetch_boy_version: '1.0',
        type: 'environment',
        exported_at: new Date().toISOString(),
        environment,
    };

    return JSON.stringify(envelope, null, 2);
}

// ─── Import Functions ─────────────────────────────────────────────────────────

export async function importCollectionFromJson(
    json: string,
): Promise<{ collection: Collection; folders: Folder[]; requests: Request[] }> {
    // Parse
    let envelope: CollectionExport;
    try {
        envelope = JSON.parse(json) as CollectionExport;
    } catch {
        throw new Error('Invalid JSON: cannot parse file');
    }

    // Validate
    if (envelope.fetch_boy_version !== '1.0') {
        throw new Error('Unsupported format version: expected 1.0');
    }
    if (envelope.type !== 'collection') {
        throw new Error(`Wrong file type: expected collection, got ${String(envelope.type)}`);
    }
    if (!envelope.collection || !envelope.collection.name) {
        throw new Error('Missing required field: collection.name');
    }

    const now = new Date().toISOString();

    // Remap IDs
    const newCollectionId = crypto.randomUUID();

    const folderIdMap = new Map<string, string>();
    for (const f of envelope.folders) {
        folderIdMap.set(f.id, crypto.randomUUID());
    }

    const collection: Collection = {
        ...envelope.collection,
        id: newCollectionId,
        default_environment_id: envelope.collection.default_environment_id ?? null,
        created_at: now,
        updated_at: now,
    };

    const folders: Folder[] = envelope.folders.map((f) => ({
        ...f,
        id: folderIdMap.get(f.id)!,
        collection_id: newCollectionId,
        parent_id: f.parent_id ? (folderIdMap.get(f.parent_id) ?? null) : null,
        created_at: now,
        updated_at: now,
    }));

    const requests: Request[] = envelope.requests.map((r) => ({
        ...r,
        id: crypto.randomUUID(),
        collection_id: newCollectionId,
        folder_id: r.folder_id ? (folderIdMap.get(r.folder_id) ?? null) : null,
        created_at: now,
        updated_at: now,
    }));

    // Write to DB inside a transaction — partial failure rolls back cleanly.
    await withTransaction(async () => {
        await insertOne('collections', ['id', 'name', 'description', 'default_environment_id', 'created_at', 'updated_at'],
            [collection.id, collection.name, collection.description, collection.default_environment_id, collection.created_at, collection.updated_at]);

        for (const f of folders) {
            await insertOne('folders', ['id', 'collection_id', 'parent_id', 'name', 'sort_order', 'created_at', 'updated_at'],
                [f.id, f.collection_id, f.parent_id, f.name, f.sort_order, f.created_at, f.updated_at]);
        }

        for (const r of requests) {
            await insertOne('requests', [
                'id', 'collection_id', 'folder_id', 'name', 'method', 'url', 'headers', 'query_params',
                'body_type', 'body_content', 'auth_type', 'auth_config', 'pre_request_script',
                'pre_request_script_enabled', 'sort_order', 'created_at', 'updated_at',
            ], [
                r.id, r.collection_id, r.folder_id, r.name, r.method, r.url,
                JSON.stringify(r.headers), JSON.stringify(r.query_params),
                r.body_type, r.body_content, r.auth_type, JSON.stringify(r.auth_config),
                r.pre_request_script ?? '', (r.pre_request_script_enabled ?? true) ? 1 : 0,
                r.sort_order, r.created_at, r.updated_at,
            ]);
        }
    });

    return { collection, folders, requests };
}

export async function importEnvironmentFromJson(json: string): Promise<Environment> {
    // Parse
    let envelope: EnvironmentExport;
    try {
        envelope = JSON.parse(json) as EnvironmentExport;
    } catch {
        throw new Error('Invalid JSON: cannot parse file');
    }

    // Validate
    if (envelope.fetch_boy_version !== '1.0') {
        throw new Error('Unsupported format version: expected 1.0');
    }
    if (envelope.type !== 'environment') {
        throw new Error(`Wrong file type: expected environment, got ${String(envelope.type)}`);
    }
    if (!envelope.environment || !envelope.environment.name) {
        throw new Error('Missing required field: environment.name');
    }

    const environment: Environment = {
        ...envelope.environment,
        id: crypto.randomUUID(),
        is_active: false,
        created_at: new Date().toISOString(),
    };

    await insertOne('environments', ['id', 'name', 'variables', 'is_active', 'created_at'],
        [environment.id, environment.name, JSON.stringify(environment.variables), 0, environment.created_at]);

    return environment;
}

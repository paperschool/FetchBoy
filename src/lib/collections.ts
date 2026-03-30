import { getDb } from '@/lib/db';
import type { Collection, Folder, KeyValuePair, Request } from '@/lib/db';
import { now, parseJsonField, insertOne } from '@/lib/dbHelpers';

// ─── Internal raw DB types ────────────────────────────────────────────────────

interface RawRequest {
    id: string;
    collection_id: string | null;
    folder_id: string | null;
    name: string;
    method: string;
    url: string;
    headers: string;
    query_params: string;
    body_type: string;
    body_content: string;
    auth_type: string;
    auth_config: string;
    pre_request_script: string;
    pre_request_script_enabled: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

function deserializeRequest(raw: RawRequest): Request {
    return {
        ...raw,
        headers: parseJsonField<KeyValuePair[]>(raw.headers, []),
        query_params: parseJsonField<KeyValuePair[]>(raw.query_params, []),
        body_type: raw.body_type as Request['body_type'],
        auth_type: raw.auth_type as Request['auth_type'],
        auth_config: parseJsonField<Record<string, string>>(raw.auth_config, {}),
        pre_request_script: raw.pre_request_script ?? '',
        pre_request_script_enabled: Boolean(raw.pre_request_script_enabled ?? 1),
    };
}

// ─── Load All ────────────────────────────────────────────────────────────────

export async function loadAllCollections(): Promise<{
    collections: Collection[];
    folders: Folder[];
    requests: Request[];
}> {
    const db = await getDb();
    const collections = await db.select<Collection[]>(
        'SELECT * FROM collections ORDER BY created_at ASC',
    );
    const folders = await db.select<Folder[]>('SELECT * FROM folders ORDER BY sort_order ASC');
    const rawRequests = await db.select<RawRequest[]>(
        'SELECT * FROM requests ORDER BY sort_order ASC',
    );
    return {
        collections,
        folders,
        requests: rawRequests.map(deserializeRequest),
    };
}

// ─── Collections ─────────────────────────────────────────────────────────────

export async function createCollection(name: string): Promise<Collection> {
    const db = await getDb();
    const col: Collection = {
        id: crypto.randomUUID(),
        name,
        description: '',
        default_environment_id: null,
        created_at: now(),
        updated_at: now(),
    };
    await db.execute(
        'INSERT INTO collections (id, name, description, default_environment_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [col.id, col.name, col.description, col.default_environment_id, col.created_at, col.updated_at],
    );
    return col;
}

export async function renameCollection(id: string, name: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE collections SET name = ?, updated_at = ? WHERE id = ?', [
        name,
        now(),
        id,
    ]);
}

export async function deleteCollection(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM collections WHERE id = ?', [id]);
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export async function createFolder(
    collectionId: string,
    name: string,
    parentId: string | null = null,
): Promise<Folder> {
    const db = await getDb();
    const folder: Folder = {
        id: crypto.randomUUID(),
        collection_id: collectionId,
        parent_id: parentId,
        name,
        sort_order: 0,
        created_at: now(),
        updated_at: now(),
    };
    await db.execute(
        'INSERT INTO folders (id, collection_id, parent_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            folder.id,
            folder.collection_id,
            folder.parent_id,
            folder.name,
            folder.sort_order,
            folder.created_at,
            folder.updated_at,
        ],
    );
    return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?', [name, now(), id]);
}

export async function deleteFolder(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM folders WHERE id = ?', [id]);
}

export async function updateFolderOrder(folderId: string, sortOrder: number): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE folders SET sort_order = ?, updated_at = ? WHERE id = ?', [
        sortOrder,
        now(),
        folderId,
    ]);
}

// ─── Request INSERT helper ────────────────────────────────────────────────────

const REQUEST_FIELDS = [
    'id', 'collection_id', 'folder_id', 'name', 'method', 'url', 'headers', 'query_params',
    'body_type', 'body_content', 'auth_type', 'auth_config', 'pre_request_script',
    'pre_request_script_enabled', 'sort_order', 'created_at', 'updated_at',
] as const;

async function insertRequestRow(req: Request): Promise<void> {
    await insertOne('requests', [...REQUEST_FIELDS], [
        req.id, req.collection_id, req.folder_id, req.name, req.method, req.url,
        JSON.stringify(req.headers), JSON.stringify(req.query_params),
        req.body_type, req.body_content, req.auth_type, JSON.stringify(req.auth_config),
        req.pre_request_script, req.pre_request_script_enabled ? 1 : 0,
        req.sort_order, req.created_at, req.updated_at,
    ]);
}

// ─── Requests ────────────────────────────────────────────────────────────────

export async function createSavedRequest(
    collectionId: string,
    name: string,
    folderId: string | null = null,
): Promise<Request> {
    const req: Request = {
        id: crypto.randomUUID(),
        collection_id: collectionId,
        folder_id: folderId,
        name,
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
        created_at: now(),
        updated_at: now(),
    };
    await insertRequestRow(req);
    return req;
}

export async function renameRequest(id: string, name: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE requests SET name = ?, updated_at = ? WHERE id = ?', [name, now(), id]);
}

export async function deleteRequest(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM requests WHERE id = ?', [id]);
}

export async function updateRequestOrder(requestId: string, sortOrder: number): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE requests SET sort_order = ?, updated_at = ? WHERE id = ?', [
        sortOrder,
        now(),
        requestId,
    ]);
}

export async function moveRequestToFolder(
    requestId: string,
    collectionId: string,
    folderId: string | null,
): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE requests SET collection_id = ?, folder_id = ?, updated_at = ? WHERE id = ?',
        [collectionId, folderId, now(), requestId],
    );
}

export async function updateSavedRequest(
    id: string,
    data: Partial<Omit<Request, 'id' | 'created_at'>>,
): Promise<void> {
    const db = await getDb();
    await db.execute(
        `UPDATE requests SET
            name = ?,
            method = ?,
            url = ?,
            headers = ?,
            query_params = ?,
            body_type = ?,
            body_content = ?,
            auth_type = ?,
            auth_config = ?,
            pre_request_script = ?,
            pre_request_script_enabled = ?,
            sort_order = ?,
            updated_at = ?
         WHERE id = ?`,
        [
            data.name ?? '',
            data.method ?? 'GET',
            data.url ?? '',
            JSON.stringify(data.headers ?? []),
            JSON.stringify(data.query_params ?? []),
            data.body_type ?? 'none',
            data.body_content ?? '',
            data.auth_type ?? 'none',
            JSON.stringify(data.auth_config ?? {}),
            data.pre_request_script ?? '',
            (data.pre_request_script_enabled ?? true) ? 1 : 0,
            data.sort_order ?? 0,
            now(),
            id,
        ],
    );
}

export async function createFullSavedRequest(
    request: Omit<Request, 'id' | 'created_at' | 'updated_at' | 'pre_request_script' | 'pre_request_script_enabled'> & {
        pre_request_script?: string;
        pre_request_script_enabled?: boolean;
    },
): Promise<Request> {
    const full: Request = {
        pre_request_script: '',
        pre_request_script_enabled: true,
        ...request,
        id: crypto.randomUUID(),
        created_at: now(),
        updated_at: now(),
    };
    await insertRequestRow(full);
    return full;
}

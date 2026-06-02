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
    pre_request_chain_id: string | null;
    pre_request_template_id: string | null;
    post_response_script: string | null;
    post_response_script_enabled: number | null;
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
        pre_request_chain_id: raw.pre_request_chain_id ?? null,
        pre_request_template_id: raw.pre_request_template_id ?? null,
        post_response_script: raw.post_response_script ?? '',
        post_response_script_enabled: Boolean(raw.post_response_script_enabled ?? 0),
    };
}

// ─── Load All ────────────────────────────────────────────────────────────────

export async function loadAllCollections(): Promise<{
    collections: Collection[];
    folders: Folder[];
    requests: Request[];
}> {
    const db = await getDb();
    const rawCollections = await db.select<Array<Collection & { pre_request_script_enabled?: number | boolean }>>(
        'SELECT * FROM collections ORDER BY created_at ASC',
    );
    const collections: Collection[] = rawCollections.map((c) => ({
        ...c,
        pre_request_script: c.pre_request_script ?? '',
        pre_request_script_enabled: Boolean(c.pre_request_script_enabled ?? 1),
    }));
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
        pre_request_script: '',
        pre_request_script_enabled: true,
        created_at: now(),
        updated_at: now(),
    };
    await db.execute(
        'INSERT INTO collections (id, name, description, default_environment_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [col.id, col.name, col.description, col.default_environment_id, col.created_at, col.updated_at],
    );
    return col;
}

export async function updateCollectionScript(
    id: string,
    script: string,
    enabled: boolean,
): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE collections SET pre_request_script = ?, pre_request_script_enabled = ?, updated_at = ? WHERE id = ?',
        [script, enabled ? 1 : 0, now(), id],
    );
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

export async function updateFolderParent(
    folderId: string,
    parentId: string | null,
): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?', [
        parentId,
        now(),
        folderId,
    ]);
}

// ─── Request INSERT helper ────────────────────────────────────────────────────

const REQUEST_FIELDS = [
    'id', 'collection_id', 'folder_id', 'name', 'method', 'url', 'headers', 'query_params',
    'body_type', 'body_content', 'auth_type', 'auth_config', 'pre_request_script',
    'pre_request_script_enabled', 'pre_request_chain_id', 'pre_request_template_id',
    'post_response_script', 'post_response_script_enabled',
    'sort_order', 'created_at', 'updated_at',
] as const;

async function insertRequestRow(req: Request): Promise<void> {
    await insertOne('requests', [...REQUEST_FIELDS], [
        req.id, req.collection_id, req.folder_id, req.name, req.method, req.url,
        JSON.stringify(req.headers), JSON.stringify(req.query_params),
        req.body_type, req.body_content, req.auth_type, JSON.stringify(req.auth_config),
        req.pre_request_script, req.pre_request_script_enabled ? 1 : 0,
        req.pre_request_chain_id, req.pre_request_template_id ?? null,
        req.post_response_script ?? '', (req.post_response_script_enabled ?? false) ? 1 : 0,
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
        pre_request_chain_id: null,
        pre_request_template_id: null,
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

/** Null out the pre-request template link on every request that referenced a now-deleted template. */
export async function clearPreRequestTemplateLinks(templateId: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE requests SET pre_request_template_id = NULL, updated_at = ? WHERE pre_request_template_id = ?',
        [now(), templateId],
    );
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
    // Partial UPDATE: only touch columns the caller actually provided. A full-row
    // UPDATE would reset omitted columns (e.g. post_response_script) to defaults,
    // silently wiping fields the caller didn't intend to change (e.g. overwrite-save).
    const sets: string[] = [];
    const values: unknown[] = [];
    const put = (col: string, val: unknown): void => {
        sets.push(`${col} = ?`);
        values.push(val);
    };
    if (data.name !== undefined) put('name', data.name);
    if (data.method !== undefined) put('method', data.method);
    if (data.url !== undefined) put('url', data.url);
    if (data.headers !== undefined) put('headers', JSON.stringify(data.headers));
    if (data.query_params !== undefined) put('query_params', JSON.stringify(data.query_params));
    if (data.body_type !== undefined) put('body_type', data.body_type);
    if (data.body_content !== undefined) put('body_content', data.body_content);
    if (data.auth_type !== undefined) put('auth_type', data.auth_type);
    if (data.auth_config !== undefined) put('auth_config', JSON.stringify(data.auth_config));
    if (data.pre_request_script !== undefined) put('pre_request_script', data.pre_request_script);
    if (data.pre_request_script_enabled !== undefined) put('pre_request_script_enabled', data.pre_request_script_enabled ? 1 : 0);
    if (data.pre_request_chain_id !== undefined) put('pre_request_chain_id', data.pre_request_chain_id);
    if (data.pre_request_template_id !== undefined) put('pre_request_template_id', data.pre_request_template_id);
    if (data.post_response_script !== undefined) put('post_response_script', data.post_response_script);
    if (data.post_response_script_enabled !== undefined) put('post_response_script_enabled', data.post_response_script_enabled ? 1 : 0);
    if (data.sort_order !== undefined) put('sort_order', data.sort_order);

    if (sets.length === 0) return; // nothing to update
    put('updated_at', now());
    values.push(id);
    await db.execute(`UPDATE requests SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function createFullSavedRequest(
    request: Omit<Request, 'id' | 'created_at' | 'updated_at' | 'pre_request_script' | 'pre_request_script_enabled' | 'pre_request_chain_id' | 'pre_request_template_id'> & {
        pre_request_script?: string;
        pre_request_script_enabled?: boolean;
        pre_request_chain_id?: string | null;
        pre_request_template_id?: string | null;
    },
): Promise<Request> {
    const full: Request = {
        pre_request_script: '',
        pre_request_script_enabled: true,
        pre_request_chain_id: null,
        pre_request_template_id: null,
        ...request,
        id: crypto.randomUUID(),
        created_at: now(),
        updated_at: now(),
    };
    await insertRequestRow(full);
    return full;
}

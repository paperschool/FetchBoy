import { getDb } from '@/lib/db';
import type { Mapping, MappingFolder, MappingHeader, MappingCookie } from '@/lib/db';
import { now, parseJsonField, insertOne, buildUpdate, syncToProxy } from '@/lib/dbHelpers';

interface RawMapping {
    id: string;
    folder_id: string | null;
    name: string;
    url_pattern: string;
    match_type: string;
    enabled: number;
    headers_add: string;
    headers_remove: string;
    cookies: string;
    response_body_enabled: number;
    response_body: string;
    response_body_content_type: string;
    response_body_file_path: string;
    url_remap_enabled: number;
    url_remap_target: string;
    use_chain: number;
    chain_id: string | null;
    created_at: string;
    updated_at: string;
}

const boolToInt = (v: unknown): number => (v ? 1 : 0);
const toJson = (v: unknown): string => JSON.stringify(v);

function deserializeMapping(raw: RawMapping): Mapping {
    return {
        ...raw,
        match_type: raw.match_type as Mapping['match_type'],
        enabled: raw.enabled === 1,
        headers_add: parseJsonField<MappingHeader[]>(raw.headers_add, []),
        headers_remove: parseJsonField<MappingHeader[]>(raw.headers_remove, []),
        cookies: parseJsonField<MappingCookie[]>(raw.cookies, []),
        response_body_enabled: raw.response_body_enabled === 1,
        response_body: raw.response_body ?? '',
        response_body_content_type: raw.response_body_content_type ?? 'application/json',
        response_body_file_path: raw.response_body_file_path ?? '',
        url_remap_enabled: raw.url_remap_enabled === 1,
        url_remap_target: raw.url_remap_target ?? '',
        use_chain: raw.use_chain === 1,
        chain_id: raw.chain_id ?? null,
    };
}

// ─── Load All ─────────────────────────────────────────────────────────────────

export async function loadAllMappings(): Promise<{
    folders: MappingFolder[];
    mappings: Mapping[];
}> {
    const db = await getDb();
    const folders = await db.select<MappingFolder[]>(
        'SELECT * FROM mapping_folders ORDER BY sort_order ASC',
    );
    const raw = await db.select<RawMapping[]>(
        'SELECT * FROM mappings ORDER BY created_at ASC',
    );
    return { folders, mappings: raw.map(deserializeMapping) };
}

// ─── Folder CRUD ─────────────────────────────────────────────────────────────

export async function createMappingFolder(name: string, sortOrder: number): Promise<MappingFolder> {
    const id = crypto.randomUUID();
    const ts = now();
    await insertOne('mapping_folders', ['id', 'name', 'sort_order', 'created_at', 'updated_at'], [id, name, sortOrder, ts, ts]);
    return { id, name, sort_order: sortOrder, created_at: ts, updated_at: ts };
}

export async function renameMappingFolder(id: string, name: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE mapping_folders SET name = ?, updated_at = ? WHERE id = ?', [name, now(), id]);
}

export async function deleteMappingFolder(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM mapping_folders WHERE id = ?', [id]);
}

// ─── Mapping CRUD ──────────────────────────────────────────────────────────

export async function createMapping(
    folderId: string | null,
    name: string,
    urlPattern: string,
    matchType: Mapping['match_type'],
): Promise<Mapping> {
    const id = crypto.randomUUID();
    const ts = now();
    await insertOne('mappings', [
        'id', 'folder_id', 'name', 'url_pattern', 'match_type', 'enabled',
        'headers_add', 'headers_remove', 'cookies',
        'response_body_enabled', 'response_body', 'response_body_content_type', 'response_body_file_path',
        'url_remap_enabled', 'url_remap_target',
        'use_chain', 'chain_id',
        'created_at', 'updated_at',
    ], [id, folderId, name, urlPattern, matchType, 1, '[]', '[]', '[]', 0, '', 'application/json', '', 0, '', 0, null, ts, ts]);
    return {
        id, folder_id: folderId, name, url_pattern: urlPattern,
        match_type: matchType, enabled: true,
        headers_add: [], headers_remove: [], cookies: [],
        response_body_enabled: false, response_body: '',
        response_body_content_type: 'application/json', response_body_file_path: '',
        url_remap_enabled: false, url_remap_target: '',
        use_chain: false, chain_id: null,
        created_at: ts, updated_at: ts,
    };
}

export async function updateMapping(
    id: string,
    changes: Partial<Pick<Mapping,
        'name' | 'url_pattern' | 'match_type' | 'enabled' |
        'response_body_enabled' | 'response_body' | 'response_body_content_type' | 'response_body_file_path' |
        'url_remap_enabled' | 'url_remap_target' | 'use_chain' | 'chain_id'> & {
        headers_add?: MappingHeader[];
        headers_remove?: MappingHeader[];
        cookies?: MappingCookie[];
    }>,
): Promise<void> {
    const update = buildUpdate('mappings', id, changes, {
        enabled: boolToInt,
        response_body_enabled: boolToInt,
        url_remap_enabled: boolToInt,
        use_chain: boolToInt,
        headers_add: toJson,
        headers_remove: toJson,
        cookies: toJson,
    });
    if (!update) return;
    const db = await getDb();
    await db.execute(update.sql, update.values);
}

export async function deleteMapping(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM mappings WHERE id = ?', [id]);
}

// ─── Proxy Sync ───────────────────────────────────────────────────────────────

export async function syncMappingsToProxy(mappings: Mapping[]): Promise<void> {
    await syncToProxy('sync_mappings', 'mappings', mappings, (m) => ({
        id: m.id, url_pattern: m.url_pattern, match_type: m.match_type, enabled: m.enabled,
        headers_add: m.headers_add, headers_remove: m.headers_remove, cookies: m.cookies,
        response_body_enabled: m.response_body_enabled, response_body: m.response_body,
        response_body_content_type: m.response_body_content_type,
        response_body_file_path: m.response_body_file_path,
        url_remap_enabled: m.url_remap_enabled, url_remap_target: m.url_remap_target,
        use_chain: m.use_chain, chain_id: m.chain_id,
    }));
}

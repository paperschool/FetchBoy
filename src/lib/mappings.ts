import { invoke } from '@tauri-apps/api/core';
import { getDb } from '@/lib/db';
import type { Mapping, MappingFolder, MappingHeader, MappingCookie } from '@/lib/db';

const now = () => new Date().toISOString();

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
    created_at: string;
    updated_at: string;
}

function parseJson<T>(raw: string, fallback: T): T {
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function deserializeMapping(raw: RawMapping): Mapping {
    return {
        ...raw,
        match_type: raw.match_type as Mapping['match_type'],
        enabled: raw.enabled === 1,
        headers_add: parseJson<MappingHeader[]>(raw.headers_add ?? '[]', []),
        headers_remove: parseJson<MappingHeader[]>(raw.headers_remove ?? '[]', []),
        cookies: parseJson<MappingCookie[]>(raw.cookies ?? '[]', []),
        response_body_enabled: raw.response_body_enabled === 1,
        response_body: raw.response_body ?? '',
        response_body_content_type: raw.response_body_content_type ?? 'application/json',
        response_body_file_path: raw.response_body_file_path ?? '',
        url_remap_enabled: raw.url_remap_enabled === 1,
        url_remap_target: raw.url_remap_target ?? '',
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
    const db = await getDb();
    const id = crypto.randomUUID();
    const ts = now();
    await db.execute(
        'INSERT INTO mapping_folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, name, sortOrder, ts, ts],
    );
    return { id, name, sort_order: sortOrder, created_at: ts, updated_at: ts };
}

export async function renameMappingFolder(id: string, name: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE mapping_folders SET name = ?, updated_at = ? WHERE id = ?',
        [name, now(), id],
    );
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
    const db = await getDb();
    const id = crypto.randomUUID();
    const ts = now();
    await db.execute(
        `INSERT INTO mappings
         (id, folder_id, name, url_pattern, match_type, enabled,
          headers_add, headers_remove, cookies,
          response_body_enabled, response_body, response_body_content_type, response_body_file_path,
          url_remap_enabled, url_remap_target,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, '[]', '[]', '[]', 0, '', 'application/json', '', 0, '', ?, ?)`,
        [id, folderId, name, urlPattern, matchType, ts, ts],
    );
    return {
        id, folder_id: folderId, name, url_pattern: urlPattern,
        match_type: matchType, enabled: true,
        headers_add: [], headers_remove: [], cookies: [],
        response_body_enabled: false,
        response_body: '',
        response_body_content_type: 'application/json',
        response_body_file_path: '',
        url_remap_enabled: false,
        url_remap_target: '',
        created_at: ts, updated_at: ts,
    };
}

export async function updateMapping(
    id: string,
    changes: Partial<Pick<Mapping,
        'name' | 'url_pattern' | 'match_type' | 'enabled' |
        'response_body_enabled' | 'response_body' | 'response_body_content_type' | 'response_body_file_path' |
        'url_remap_enabled' | 'url_remap_target'> & {
        headers_add?: MappingHeader[];
        headers_remove?: MappingHeader[];
        cookies?: MappingCookie[];
    }>,
): Promise<void> {
    const db = await getDb();
    const parts: string[] = [];
    const values: unknown[] = [];
    if (changes.name !== undefined) { parts.push('name = ?'); values.push(changes.name); }
    if (changes.url_pattern !== undefined) { parts.push('url_pattern = ?'); values.push(changes.url_pattern); }
    if (changes.match_type !== undefined) { parts.push('match_type = ?'); values.push(changes.match_type); }
    if (changes.enabled !== undefined) { parts.push('enabled = ?'); values.push(changes.enabled ? 1 : 0); }
    if (changes.headers_add !== undefined) { parts.push('headers_add = ?'); values.push(JSON.stringify(changes.headers_add)); }
    if (changes.headers_remove !== undefined) { parts.push('headers_remove = ?'); values.push(JSON.stringify(changes.headers_remove)); }
    if (changes.cookies !== undefined) { parts.push('cookies = ?'); values.push(JSON.stringify(changes.cookies)); }
    if (changes.response_body_enabled !== undefined) {
        parts.push('response_body_enabled = ?');
        values.push(changes.response_body_enabled ? 1 : 0);
    }
    if (changes.response_body !== undefined) { parts.push('response_body = ?'); values.push(changes.response_body); }
    if (changes.response_body_content_type !== undefined) {
        parts.push('response_body_content_type = ?');
        values.push(changes.response_body_content_type);
    }
    if (changes.response_body_file_path !== undefined) {
        parts.push('response_body_file_path = ?');
        values.push(changes.response_body_file_path);
    }
    if (changes.url_remap_enabled !== undefined) {
        parts.push('url_remap_enabled = ?');
        values.push(changes.url_remap_enabled ? 1 : 0);
    }
    if (changes.url_remap_target !== undefined) { parts.push('url_remap_target = ?'); values.push(changes.url_remap_target); }
    if (parts.length === 0) return;
    parts.push('updated_at = ?');
    values.push(now());
    values.push(id);
    await db.execute(`UPDATE mappings SET ${parts.join(', ')} WHERE id = ?`, values);
}

export async function deleteMapping(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM mappings WHERE id = ?', [id]);
}

// ─── Proxy Sync ───────────────────────────────────────────────────────────────

export async function syncMappingsToProxy(mappings: Mapping[]): Promise<void> {
    await invoke('sync_mappings', {
        mappings: mappings.map((m) => ({
            id: m.id,
            url_pattern: m.url_pattern,
            match_type: m.match_type,
            enabled: m.enabled,
            headers_add: m.headers_add,
            headers_remove: m.headers_remove,
            cookies: m.cookies,
            response_body_enabled: m.response_body_enabled,
            response_body: m.response_body,
            response_body_content_type: m.response_body_content_type,
            response_body_file_path: m.response_body_file_path,
            url_remap_enabled: m.url_remap_enabled,
            url_remap_target: m.url_remap_target,
        })),
    }).catch(() => {});
}

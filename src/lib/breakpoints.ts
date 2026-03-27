import { getDb } from '@/lib/db';
import type { Breakpoint, BreakpointFolder, BreakpointHeader } from '@/lib/db';
import { now, parseJsonField, insertOne, buildUpdate, syncToProxy } from '@/lib/dbHelpers';

interface RawBreakpoint {
    id: string;
    folder_id: string | null;
    name: string;
    url_pattern: string;
    match_type: string;
    enabled: number;
    response_mapping_enabled: number;
    response_mapping_body: string;
    response_mapping_content_type: string;
    status_code_enabled: number;
    status_code_value: number;
    custom_headers: string;
    block_request_enabled: number;
    block_request_status_code: number;
    block_request_body: string;
    created_at: string;
    updated_at: string;
}

const boolToInt = (v: unknown): number => (v ? 1 : 0);
const toJson = (v: unknown): string => JSON.stringify(v);

function deserializeBreakpoint(raw: RawBreakpoint): Breakpoint {
    return {
        ...raw,
        match_type: raw.match_type as Breakpoint['match_type'],
        enabled: raw.enabled === 1,
        response_mapping_enabled: raw.response_mapping_enabled === 1,
        response_mapping_body: raw.response_mapping_body ?? '',
        response_mapping_content_type: raw.response_mapping_content_type ?? 'application/json',
        status_code_enabled: raw.status_code_enabled === 1,
        status_code_value: raw.status_code_value ?? 200,
        custom_headers: parseJsonField<BreakpointHeader[]>(raw.custom_headers, []),
        block_request_enabled: raw.block_request_enabled === 1,
        block_request_status_code: raw.block_request_status_code ?? 501,
        block_request_body: raw.block_request_body ?? '',
    };
}

// ─── Load All ─────────────────────────────────────────────────────────────────

export async function loadAllBreakpoints(): Promise<{
    folders: BreakpointFolder[];
    breakpoints: Breakpoint[];
}> {
    const db = await getDb();
    const folders = await db.select<BreakpointFolder[]>(
        'SELECT * FROM breakpoint_folders ORDER BY sort_order ASC',
    );
    const raw = await db.select<RawBreakpoint[]>(
        'SELECT * FROM breakpoints ORDER BY created_at ASC',
    );
    return { folders, breakpoints: raw.map(deserializeBreakpoint) };
}

// ─── Folder CRUD ─────────────────────────────────────────────────────────────

export async function createBreakpointFolder(name: string, sortOrder: number): Promise<BreakpointFolder> {
    const id = crypto.randomUUID();
    const ts = now();
    await insertOne('breakpoint_folders', ['id', 'name', 'sort_order', 'created_at', 'updated_at'], [id, name, sortOrder, ts, ts]);
    return { id, name, sort_order: sortOrder, created_at: ts, updated_at: ts };
}

export async function renameBreakpointFolder(id: string, name: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE breakpoint_folders SET name = ?, updated_at = ? WHERE id = ?', [name, now(), id]);
}

export async function deleteBreakpointFolder(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM breakpoint_folders WHERE id = ?', [id]);
}

// ─── Breakpoint CRUD ──────────────────────────────────────────────────────────

export async function createBreakpoint(
    folderId: string | null,
    name: string,
    urlPattern: string,
    matchType: Breakpoint['match_type'],
): Promise<Breakpoint> {
    const id = crypto.randomUUID();
    const ts = now();
    await insertOne('breakpoints', [
        'id', 'folder_id', 'name', 'url_pattern', 'match_type', 'enabled',
        'response_mapping_enabled', 'response_mapping_body', 'response_mapping_content_type',
        'status_code_enabled', 'status_code_value', 'custom_headers',
        'block_request_enabled', 'block_request_status_code', 'block_request_body',
        'created_at', 'updated_at',
    ], [id, folderId, name, urlPattern, matchType, 1, 0, '', 'application/json', 0, 200, '[]', 0, 501, '', ts, ts]);
    return {
        id, folder_id: folderId, name, url_pattern: urlPattern,
        match_type: matchType, enabled: true,
        response_mapping_enabled: false, response_mapping_body: '',
        response_mapping_content_type: 'application/json',
        status_code_enabled: false, status_code_value: 200,
        custom_headers: [],
        block_request_enabled: false, block_request_status_code: 501, block_request_body: '',
        created_at: ts, updated_at: ts,
    };
}

export async function updateBreakpoint(
    id: string,
    changes: Partial<Pick<Breakpoint,
        'name' | 'url_pattern' | 'match_type' | 'enabled' |
        'response_mapping_enabled' | 'response_mapping_body' | 'response_mapping_content_type' |
        'status_code_enabled' | 'status_code_value' |
        'block_request_enabled' | 'block_request_status_code' | 'block_request_body'> & { custom_headers?: BreakpointHeader[] }>,
): Promise<void> {
    const update = buildUpdate('breakpoints', id, changes, {
        enabled: boolToInt,
        response_mapping_enabled: boolToInt,
        status_code_enabled: boolToInt,
        block_request_enabled: boolToInt,
        custom_headers: toJson,
    });
    if (!update) return;
    const db = await getDb();
    await db.execute(update.sql, update.values);
}

export async function deleteBreakpoint(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM breakpoints WHERE id = ?', [id]);
}

// ─── Proxy Sync ───────────────────────────────────────────────────────────────

export async function syncBreakpointsToProxy(breakpoints: Breakpoint[]): Promise<void> {
    await syncToProxy('sync_breakpoints', 'breakpoints', breakpoints, (bp) => ({
        id: bp.id, url_pattern: bp.url_pattern, match_type: bp.match_type, enabled: bp.enabled,
        response_mapping_enabled: bp.response_mapping_enabled, response_mapping_body: bp.response_mapping_body,
        response_mapping_content_type: bp.response_mapping_content_type,
        status_code_enabled: bp.status_code_enabled, status_code_value: bp.status_code_value,
        custom_headers: bp.custom_headers,
        block_request_enabled: bp.block_request_enabled, block_request_status_code: bp.block_request_status_code,
        block_request_body: bp.block_request_body,
    }));
}

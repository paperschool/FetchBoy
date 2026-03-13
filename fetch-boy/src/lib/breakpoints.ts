import { invoke } from '@tauri-apps/api/core';
import { getDb } from '@/lib/db';
import type { Breakpoint, BreakpointFolder, BreakpointHeader } from '@/lib/db';

const now = () => new Date().toISOString();

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

function parseHeaders(raw: string): BreakpointHeader[] {
    try {
        return JSON.parse(raw) as BreakpointHeader[];
    } catch {
        return [];
    }
}

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
        custom_headers: parseHeaders(raw.custom_headers ?? '[]'),
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
    const db = await getDb();
    const id = crypto.randomUUID();
    const ts = now();
    await db.execute(
        'INSERT INTO breakpoint_folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, name, sortOrder, ts, ts],
    );
    return { id, name, sort_order: sortOrder, created_at: ts, updated_at: ts };
}

export async function renameBreakpointFolder(id: string, name: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE breakpoint_folders SET name = ?, updated_at = ? WHERE id = ?',
        [name, now(), id],
    );
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
    const db = await getDb();
    const id = crypto.randomUUID();
    const ts = now();
    await db.execute(
        `INSERT INTO breakpoints
         (id, folder_id, name, url_pattern, match_type, enabled,
          response_mapping_enabled, response_mapping_body, response_mapping_content_type,
          status_code_enabled, status_code_value, custom_headers,
          block_request_enabled, block_request_status_code, block_request_body,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, '', 'application/json', 0, 200, '[]', 0, 501, '', ?, ?)`,
        [id, folderId, name, urlPattern, matchType, 1, ts, ts],
    );
    return {
        id, folder_id: folderId, name, url_pattern: urlPattern,
        match_type: matchType, enabled: true,
        response_mapping_enabled: false,
        response_mapping_body: '',
        response_mapping_content_type: 'application/json',
        status_code_enabled: false,
        status_code_value: 200,
        custom_headers: [],
        block_request_enabled: false,
        block_request_status_code: 501,
        block_request_body: '',
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
    const db = await getDb();
    const parts: string[] = [];
    const values: unknown[] = [];
    if (changes.name !== undefined) { parts.push('name = ?'); values.push(changes.name); }
    if (changes.url_pattern !== undefined) { parts.push('url_pattern = ?'); values.push(changes.url_pattern); }
    if (changes.match_type !== undefined) { parts.push('match_type = ?'); values.push(changes.match_type); }
    if (changes.enabled !== undefined) { parts.push('enabled = ?'); values.push(changes.enabled ? 1 : 0); }
    if (changes.response_mapping_enabled !== undefined) {
        parts.push('response_mapping_enabled = ?');
        values.push(changes.response_mapping_enabled ? 1 : 0);
    }
    if (changes.response_mapping_body !== undefined) {
        parts.push('response_mapping_body = ?');
        values.push(changes.response_mapping_body);
    }
    if (changes.response_mapping_content_type !== undefined) {
        parts.push('response_mapping_content_type = ?');
        values.push(changes.response_mapping_content_type);
    }
    if (changes.status_code_enabled !== undefined) {
        parts.push('status_code_enabled = ?');
        values.push(changes.status_code_enabled ? 1 : 0);
    }
    if (changes.status_code_value !== undefined) {
        parts.push('status_code_value = ?');
        values.push(changes.status_code_value);
    }
    if (changes.custom_headers !== undefined) {
        parts.push('custom_headers = ?');
        values.push(JSON.stringify(changes.custom_headers));
    }
    if (changes.block_request_enabled !== undefined) {
        parts.push('block_request_enabled = ?');
        values.push(changes.block_request_enabled ? 1 : 0);
    }
    if (changes.block_request_status_code !== undefined) {
        parts.push('block_request_status_code = ?');
        values.push(changes.block_request_status_code);
    }
    if (changes.block_request_body !== undefined) {
        parts.push('block_request_body = ?');
        values.push(changes.block_request_body);
    }
    if (parts.length === 0) return;
    parts.push('updated_at = ?');
    values.push(now());
    values.push(id);
    await db.execute(`UPDATE breakpoints SET ${parts.join(', ')} WHERE id = ?`, values);
}

export async function deleteBreakpoint(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM breakpoints WHERE id = ?', [id]);
}

// ─── Proxy Sync ───────────────────────────────────────────────────────────────

export async function syncBreakpointsToProxy(breakpoints: Breakpoint[]): Promise<void> {
    await invoke('sync_breakpoints', {
        breakpoints: breakpoints.map((bp) => ({
            id: bp.id,
            url_pattern: bp.url_pattern,
            match_type: bp.match_type,
            enabled: bp.enabled,
            response_mapping_enabled: bp.response_mapping_enabled,
            response_mapping_body: bp.response_mapping_body,
            response_mapping_content_type: bp.response_mapping_content_type,
            status_code_enabled: bp.status_code_enabled,
            status_code_value: bp.status_code_value,
            custom_headers: bp.custom_headers,
            block_request_enabled: bp.block_request_enabled,
            block_request_status_code: bp.block_request_status_code,
            block_request_body: bp.block_request_body,
        })),
    }).catch(() => {});
}

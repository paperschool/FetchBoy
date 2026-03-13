import { invoke } from '@tauri-apps/api/core';
import { getDb } from '@/lib/db';
import type { Breakpoint, BreakpointFolder } from '@/lib/db';

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
    created_at: string;
    updated_at: string;
}

function deserializeBreakpoint(raw: RawBreakpoint): Breakpoint {
    return {
        ...raw,
        match_type: raw.match_type as Breakpoint['match_type'],
        enabled: raw.enabled === 1,
        response_mapping_enabled: raw.response_mapping_enabled === 1,
        response_mapping_body: raw.response_mapping_body ?? '',
        response_mapping_content_type: raw.response_mapping_content_type ?? 'application/json',
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
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, '', 'application/json', ?, ?)`,
        [id, folderId, name, urlPattern, matchType, 1, ts, ts],
    );
    return {
        id, folder_id: folderId, name, url_pattern: urlPattern,
        match_type: matchType, enabled: true,
        response_mapping_enabled: false,
        response_mapping_body: '',
        response_mapping_content_type: 'application/json',
        created_at: ts, updated_at: ts,
    };
}

export async function updateBreakpoint(
    id: string,
    changes: Partial<Pick<Breakpoint,
        'name' | 'url_pattern' | 'match_type' | 'enabled' |
        'response_mapping_enabled' | 'response_mapping_body' | 'response_mapping_content_type'>>,
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
        })),
    }).catch(() => {});
}

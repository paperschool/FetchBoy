import Database from '@tauri-apps/plugin-sql';

export const DB_PATH = 'sqlite:fetch-boy.db';

// ─── Data Model Interfaces ────────────────────────────────────────────────────

export interface KeyValuePair {
    key: string;
    value: string;
    enabled: boolean;
    secret?: boolean;
}

export interface Collection {
    id: string;
    name: string;
    description: string;
    default_environment_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface Folder {
    id: string;
    collection_id: string;
    parent_id: string | null;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface Request {
    id: string;
    collection_id: string | null;
    folder_id: string | null;
    name: string;
    method: string;
    url: string;
    headers: KeyValuePair[];
    query_params: KeyValuePair[];
    body_type: 'none' | 'raw' | 'json' | 'form-data' | 'urlencoded';
    body_content: string;
    auth_type: 'none' | 'bearer' | 'basic' | 'api-key';
    auth_config: Record<string, string>;
    pre_request_script: string;
    pre_request_script_enabled: boolean;
    pre_request_chain_id?: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface Environment {
    id: string;
    name: string;
    variables: KeyValuePair[];
    is_active: boolean;
    created_at: string;
}

export interface HistoryEntry {
    id: string;
    method: string;
    url: string;
    status_code: number;
    response_time_ms: number;
    request_snapshot: Request;
    sent_at: string;
}

export interface BreakpointFolder {
    id: string;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface BreakpointHeader {
    key: string;
    value: string;
    enabled: boolean;
}

export interface Breakpoint {
    id: string;
    folder_id: string | null;
    name: string;
    url_pattern: string;
    match_type: 'exact' | 'partial' | 'wildcard' | 'regex';
    enabled: boolean;
    response_mapping_enabled: boolean;
    response_mapping_body: string;
    response_mapping_content_type: string;
    status_code_enabled: boolean;
    status_code_value: number;
    custom_headers: BreakpointHeader[];
    block_request_enabled: boolean;
    block_request_status_code: number;
    block_request_body: string;
    created_at: string;
    updated_at: string;
}

export interface MappingFolder {
    id: string;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface MappingHeader {
    key: string;
    value: string;
    enabled: boolean;
}

export interface MappingCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'Lax' | 'Strict' | 'None';
    expires: string;
}

export interface Mapping {
    id: string;
    folder_id: string | null;
    name: string;
    url_pattern: string;
    match_type: 'exact' | 'partial' | 'wildcard' | 'regex';
    enabled: boolean;
    headers_add: MappingHeader[];
    headers_remove: MappingHeader[];
    cookies: MappingCookie[];
    response_body_enabled: boolean;
    response_body: string;
    response_body_content_type: string;
    response_body_file_path: string;
    url_remap_enabled: boolean;
    url_remap_target: string;
    use_chain: boolean;
    chain_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface AppSettings {
    theme: 'light' | 'dark' | 'system';
    request_timeout_ms: number;
    ssl_verify: boolean;
    editor_font_size: number;
    sidebar_collapsed?: boolean;
    sidebar_settings_expanded?: boolean;
    has_seeded_sample_data?: boolean;
    last_seen_version?: string | null;
    proxy_enabled?: boolean;
    proxy_port?: number;
}

// ─── Singleton Database Handle ────────────────────────────────────────────────

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
    if (_db === null) {
        _db = await Database.load(DB_PATH);
        await _db.execute('PRAGMA journal_mode = WAL');
        await _db.execute('PRAGMA busy_timeout = 5000');
        await _db.execute('PRAGMA foreign_keys = ON');
        // Ensure parent_node_id column exists (migration 011 may not have run via Tauri yet)
        try {
            await _db.execute('ALTER TABLE stitch_nodes ADD COLUMN parent_node_id TEXT REFERENCES stitch_nodes(id) ON DELETE CASCADE');
        } catch {
            // Column already exists — safe to ignore
        }
        // Ensure mapping chain columns exist (migration 012)
        try { await _db.execute('ALTER TABLE mappings ADD COLUMN use_chain INTEGER NOT NULL DEFAULT 0'); } catch { /* exists */ }
        try { await _db.execute('ALTER TABLE mappings ADD COLUMN chain_id TEXT REFERENCES stitch_chains(id) ON DELETE SET NULL'); } catch { /* exists */ }
        try { await _db.execute('ALTER TABLE stitch_chains ADD COLUMN mapping_id TEXT REFERENCES mappings(id) ON DELETE SET NULL'); } catch { /* exists */ }
        // Ensure stitch folder columns exist (migration 014)
        await _db.execute(`CREATE TABLE IF NOT EXISTS stitch_folders (
            id TEXT PRIMARY KEY NOT NULL, parent_id TEXT, name TEXT NOT NULL DEFAULT 'New Folder',
            sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )`);
        try { await _db.execute('ALTER TABLE stitch_chains ADD COLUMN folder_id TEXT'); } catch { /* exists */ }
        try { await _db.execute('ALTER TABLE stitch_chains ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0'); } catch { /* exists */ }
        // Ensure pre_request_chain columns exist (migration 015)
        try { await _db.execute('ALTER TABLE requests ADD COLUMN pre_request_chain_id TEXT'); } catch { /* exists */ }
        try { await _db.execute('ALTER TABLE stitch_chains ADD COLUMN request_id TEXT'); } catch { /* exists */ }
    }
    return _db;
}

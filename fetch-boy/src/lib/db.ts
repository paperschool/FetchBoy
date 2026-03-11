import Database from '@tauri-apps/plugin-sql';

export const DB_PATH = 'sqlite:fetch-boy.db';

// ─── Data Model Interfaces ────────────────────────────────────────────────────

export interface KeyValuePair {
    key: string;
    value: string;
    enabled: boolean;
}

export interface Collection {
    id: string;
    name: string;
    description: string;
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

export interface AppSettings {
    theme: 'light' | 'dark' | 'system';
    request_timeout_ms: number;
    ssl_verify: boolean;
    editor_font_size: number;
    sidebar_collapsed?: boolean;
}

// ─── Singleton Database Handle ────────────────────────────────────────────────

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
    if (_db === null) {
        _db = await Database.load(DB_PATH);
    }
    return _db;
}

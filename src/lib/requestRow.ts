import type { Request } from '@/lib/db';

/**
 * Single source of truth for the `requests` INSERT column list + row serializer.
 * Shared by every persist path (collections.ts, importers/persist.ts,
 * importExport.ts) so a newly-added column can never be silently dropped on one
 * path (the exact class of bug Story 21.3 had to fix). Add a column here once.
 */
export const REQUEST_COLS = [
    'id', 'collection_id', 'folder_id', 'name', 'method', 'url', 'headers', 'query_params',
    'body_type', 'body_content', 'auth_type', 'auth_config', 'pre_request_script',
    'pre_request_script_enabled', 'pre_request_chain_id', 'pre_request_template_id',
    'post_response_script', 'post_response_script_enabled',
    'sort_order', 'created_at', 'updated_at',
] as const;

export function requestRow(r: Request): unknown[] {
    return [
        r.id, r.collection_id, r.folder_id, r.name, r.method, r.url,
        JSON.stringify(r.headers), JSON.stringify(r.query_params),
        r.body_type, r.body_content, r.auth_type, JSON.stringify(r.auth_config),
        r.pre_request_script ?? '', (r.pre_request_script_enabled ?? true) ? 1 : 0,
        r.pre_request_chain_id ?? null, r.pre_request_template_id ?? null,
        r.post_response_script ?? '', (r.post_response_script_enabled ?? false) ? 1 : 0,
        r.sort_order, r.created_at, r.updated_at,
    ];
}

import type { HistoryEntry, Request } from '@/lib/db';
import type { RequestSnapshot } from '@/stores/tabStore';
import type { AuthState, BodyMode, HttpMethod } from '@/stores/requestStore';

function authConfigToState(
    authType: Request['auth_type'],
    authConfig: Record<string, string>,
): AuthState {
    switch (authType) {
        case 'bearer':
            return { type: 'bearer', token: authConfig['token'] ?? '' };
        case 'basic':
            return {
                type: 'basic',
                username: authConfig['username'] ?? '',
                password: authConfig['password'] ?? '',
            };
        case 'api-key':
            return {
                type: 'api-key',
                key: authConfig['key'] ?? '',
                value: authConfig['value'] ?? '',
                in: (authConfig['in'] as 'header' | 'query') ?? 'header',
            };
        default:
            return { type: 'none' };
    }
}

export function buildSnapshotFromSaved(request: Request): RequestSnapshot {
    return {
        method: request.method as HttpMethod,
        url: request.url,
        headers: request.headers.map((h) => ({
            key: h.key,
            value: h.value,
            enabled: h.enabled,
        })),
        queryParams: request.query_params.map((p) => ({
            key: p.key,
            value: p.value,
            enabled: p.enabled,
        })),
        body: {
            mode: request.body_type as BodyMode,
            raw: request.body_content,
        },
        auth: authConfigToState(request.auth_type, request.auth_config),
        activeTab: 'headers',
        isDirty: false,
        timeout: 0,
    };
}

export function buildSnapshotFromHistory(entry: HistoryEntry): RequestSnapshot {
    return buildSnapshotFromSaved(entry.request_snapshot);
}

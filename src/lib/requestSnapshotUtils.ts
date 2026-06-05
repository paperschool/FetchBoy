import type { Request } from '@/lib/db';
import type { RequestSnapshot } from '@/stores/tabStore';
import type { AuthState } from '@/stores/requestStore';
import { isHttpMethod, isBodyMode, isApiKeyIn } from '@/lib/validators';
import { authStateToConfig } from '@/lib/urlUtils';

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
                in: isApiKeyIn(authConfig['in'] ?? '') ? authConfig['in'] as 'header' | 'query' : 'header',
            };
        default:
            return { type: 'none' };
    }
}

/**
 * Inverse of buildSnapshotFromSaved: the DB-shaped partial of a saved request's
 * mutable fields, derived from a tab snapshot. Used when saving a tab's edits in
 * place (the Save button and the close-tab guard). Mirrors the `changes` built by
 * useCollectionCrud.handleUpdateRequest so all save paths persist the same fields.
 */
export function buildSavedChangesFromSnapshot(s: RequestSnapshot): Partial<Request> {
    return {
        method: s.method,
        url: s.url,
        headers: s.headers,
        query_params: s.queryParams,
        body_type: s.body.mode,
        body_content: s.body.raw,
        auth_type: s.auth.type,
        auth_config: authStateToConfig(s.auth),
        pre_request_script: s.preRequestScript,
        pre_request_script_enabled: s.preRequestScriptEnabled,
        pre_request_template_id: s.preRequestTemplateId,
        post_response_script: s.postResponseScript,
        post_response_script_enabled: s.postResponseScriptEnabled,
    };
}

export function buildSnapshotFromSaved(request: Request): RequestSnapshot {
    // Restore the pre-request view from what the request actually has. Pre-request
    // chains were retired, so a stored chain id no longer maps to 'chain' mode.
    const hasScript = !!request.pre_request_script?.trim() || !!request.pre_request_template_id;
    const preRequestMode: RequestSnapshot['preRequestMode'] = hasScript ? 'javascript' : 'none';

    return {
        savedRequestId: request.id,
        method: isHttpMethod(request.method) ? request.method : 'GET',
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
            mode: isBodyMode(request.body_type) ? request.body_type : 'raw',
            raw: request.body_content,
        },
        auth: authConfigToState(request.auth_type, request.auth_config),
        activeTab: 'headers',
        isDirty: false,
        timeout: 0,
        preRequestScript: request.pre_request_script ?? '',
        preRequestScriptEnabled: request.pre_request_script_enabled ?? true,
        scriptKeepOpen: false,
        preRequestChainId: request.pre_request_chain_id ?? null,
        preRequestTemplateId: request.pre_request_template_id ?? null,
        preRequestMode,
        postResponseScript: request.post_response_script ?? '',
        postResponseScriptEnabled: request.post_response_script_enabled ?? false,
    };
}

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Request } from '@/lib/db';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type RequestTab = 'headers' | 'query' | 'body' | 'auth' | 'options';

export type AuthState =
    | { type: 'none' }
    | { type: 'bearer'; token: string }
    | { type: 'basic'; username: string; password: string }
    | { type: 'api-key'; key: string; value: string; in: 'header' | 'query' };

export type BodyMode = 'none' | 'raw' | 'json' | 'form-data' | 'urlencoded';

export interface KeyValueRow {
    key: string;
    value: string;
    enabled: boolean;
}

interface RequestState {
    method: HttpMethod;
    url: string;
    headers: KeyValueRow[];
    queryParams: KeyValueRow[];
    body: {
        mode: BodyMode;
        raw: string;
    };
    auth: AuthState;
    activeTab: RequestTab;
    isDirty: boolean;
    setMethod: (method: HttpMethod) => void;
    setUrl: (url: string) => void;
    setActiveTab: (tab: RequestTab) => void;
    addHeader: () => void;
    updateHeader: (index: number, field: 'key' | 'value', value: string) => void;
    toggleHeaderEnabled: (index: number) => void;
    removeHeader: (index: number) => void;
    addQueryParam: () => void;
    updateQueryParam: (index: number, field: 'key' | 'value', value: string) => void;
    toggleQueryParamEnabled: (index: number) => void;
    removeQueryParam: (index: number) => void;
    setAuth: (auth: AuthState) => void;
    setBodyRaw: (raw: string) => void;
    loadFromSaved: (request: Request) => void;
    markDirty: (dirty?: boolean) => void;
}

const createKeyValueRow = (): KeyValueRow => ({
    key: '',
    value: '',
    enabled: true,
});

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

export const useRequestStore = create<RequestState>()(
    immer((set) => ({
        method: 'GET',
        url: '',
        headers: [],
        queryParams: [],
        body: {
            mode: 'raw',
            raw: '',
        },
        auth: {
            type: 'none',
        },
        activeTab: 'headers',
        isDirty: false,
        setMethod: (method) =>
            set((state) => {
                state.method = method;
                state.isDirty = true;
            }),
        setUrl: (url) =>
            set((state) => {
                state.url = url;
                state.isDirty = true;
            }),
        setActiveTab: (tab) =>
            set((state) => {
                state.activeTab = tab;
            }),
        addHeader: () =>
            set((state) => {
                state.headers.push(createKeyValueRow());
                state.isDirty = true;
            }),
        updateHeader: (index, field, value) =>
            set((state) => {
                if (state.headers[index]) {
                    state.headers[index][field] = value;
                    state.isDirty = true;
                }
            }),
        toggleHeaderEnabled: (index) =>
            set((state) => {
                if (state.headers[index]) {
                    state.headers[index].enabled = !state.headers[index].enabled;
                    state.isDirty = true;
                }
            }),
        removeHeader: (index) =>
            set((state) => {
                if (state.headers[index]) {
                    state.headers.splice(index, 1);
                    state.isDirty = true;
                }
            }),
        addQueryParam: () =>
            set((state) => {
                state.queryParams.push(createKeyValueRow());
                state.isDirty = true;
            }),
        updateQueryParam: (index, field, value) =>
            set((state) => {
                if (state.queryParams[index]) {
                    state.queryParams[index][field] = value;
                    state.isDirty = true;
                }
            }),
        toggleQueryParamEnabled: (index) =>
            set((state) => {
                if (state.queryParams[index]) {
                    state.queryParams[index].enabled = !state.queryParams[index].enabled;
                    state.isDirty = true;
                }
            }),
        removeQueryParam: (index) =>
            set((state) => {
                if (state.queryParams[index]) {
                    state.queryParams.splice(index, 1);
                    state.isDirty = true;
                }
            }),
        setAuth: (auth) =>
            set((state) => {
                state.auth = auth;
                state.isDirty = true;
            }),
        setBodyRaw: (raw) =>
            set((state) => {
                state.body.raw = raw;
                state.isDirty = true;
            }),
        loadFromSaved: (request) =>
            set((state) => {
                state.method = request.method as HttpMethod;
                state.url = request.url;
                state.headers = request.headers.map((h) => ({
                    key: h.key,
                    value: h.value,
                    enabled: h.enabled,
                }));
                state.queryParams = request.query_params.map((p) => ({
                    key: p.key,
                    value: p.value,
                    enabled: p.enabled,
                }));
                state.body = {
                    mode: request.body_type as BodyMode,
                    raw: request.body_content,
                };
                state.auth = authConfigToState(request.auth_type, request.auth_config);
                state.isDirty = false;
            }),
        markDirty: (dirty = true) =>
            set((state) => {
                state.isDirty = dirty;
            }),
    })),
);

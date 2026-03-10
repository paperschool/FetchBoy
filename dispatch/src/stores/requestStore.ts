import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type RequestTab = 'headers' | 'query' | 'body' | 'auth';

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
        mode: 'raw';
        raw: string;
    };
    auth: {
        type: 'none';
    };
    activeTab: RequestTab;
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
    setBodyRaw: (raw: string) => void;
}

const createKeyValueRow = (): KeyValueRow => ({
    key: '',
    value: '',
    enabled: true,
});

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
        setMethod: (method) =>
            set((state) => {
                state.method = method;
            }),
        setUrl: (url) =>
            set((state) => {
                state.url = url;
            }),
        setActiveTab: (tab) =>
            set((state) => {
                state.activeTab = tab;
            }),
        addHeader: () =>
            set((state) => {
                state.headers.push(createKeyValueRow());
            }),
        updateHeader: (index, field, value) =>
            set((state) => {
                if (state.headers[index]) {
                    state.headers[index][field] = value;
                }
            }),
        toggleHeaderEnabled: (index) =>
            set((state) => {
                if (state.headers[index]) {
                    state.headers[index].enabled = !state.headers[index].enabled;
                }
            }),
        removeHeader: (index) =>
            set((state) => {
                if (state.headers[index]) {
                    state.headers.splice(index, 1);
                }
            }),
        addQueryParam: () =>
            set((state) => {
                state.queryParams.push(createKeyValueRow());
            }),
        updateQueryParam: (index, field, value) =>
            set((state) => {
                if (state.queryParams[index]) {
                    state.queryParams[index][field] = value;
                }
            }),
        toggleQueryParamEnabled: (index) =>
            set((state) => {
                if (state.queryParams[index]) {
                    state.queryParams[index].enabled = !state.queryParams[index].enabled;
                }
            }),
        removeQueryParam: (index) =>
            set((state) => {
                if (state.queryParams[index]) {
                    state.queryParams.splice(index, 1);
                }
            }),
        setBodyRaw: (raw) =>
            set((state) => {
                state.body.raw = raw;
            }),
    })),
);

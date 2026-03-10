import { describe, it, expect, beforeEach } from 'vitest';
import { useRequestStore } from './requestStore';
import type { Request } from '@/lib/db';

const makeRequest = (o: Partial<Request> = {}): Request => ({
    id: 'req-1',
    collection_id: 'col-1',
    folder_id: null,
    name: 'Get Users',
    method: 'POST',
    url: 'https://api.example.com/users',
    headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    query_params: [{ key: 'page', value: '2', enabled: true }],
    body_type: 'raw',
    body_content: '{"hello":"world"}',
    auth_type: 'none',
    auth_config: {},
    sort_order: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...o,
});

describe('requestStore', () => {
    beforeEach(() => {
        useRequestStore.setState({
            method: 'GET',
            url: '',
            headers: [],
            queryParams: [],
            body: { mode: 'raw', raw: '' },
            auth: { type: 'none' },
            activeTab: 'headers',
            isDirty: false,
        });
    });

    it('has GET as initial method', () => {
        const { method } = useRequestStore.getState();
        expect(method).toBe('GET');
    });

    it('has empty string as initial url', () => {
        const { url } = useRequestStore.getState();
        expect(url).toBe('');
    });

    it('setMethod updates the method', () => {
        const { setMethod } = useRequestStore.getState();
        setMethod('POST');
        expect(useRequestStore.getState().method).toBe('POST');
    });

    it('setUrl updates the url', () => {
        const { setUrl } = useRequestStore.getState();
        setUrl('https://api.example.com/users');
        expect(useRequestStore.getState().url).toBe('https://api.example.com/users');
    });

    it('setMethod does not affect url', () => {
        const { setMethod, setUrl } = useRequestStore.getState();
        setUrl('https://example.com');
        setMethod('DELETE');
        expect(useRequestStore.getState().url).toBe('https://example.com');
        expect(useRequestStore.getState().method).toBe('DELETE');
    });

    it('has request builder defaults', () => {
        const state = useRequestStore.getState();
        expect(state.headers).toEqual([]);
        expect(state.queryParams).toEqual([]);
        expect(state.body).toEqual({ mode: 'raw', raw: '' });
        expect(state.auth).toEqual({ type: 'none' });
        expect(state.activeTab).toBe('headers');
    });

    it('can add, update, toggle and remove header rows', () => {
        const state = useRequestStore.getState();

        state.addHeader();
        expect(useRequestStore.getState().headers).toHaveLength(1);

        state.updateHeader(0, 'key', 'Authorization');
        state.updateHeader(0, 'value', 'Bearer token');
        expect(useRequestStore.getState().headers[0]).toEqual({
            key: 'Authorization',
            value: 'Bearer token',
            enabled: true,
        });

        state.toggleHeaderEnabled(0);
        expect(useRequestStore.getState().headers[0].enabled).toBe(false);

        state.removeHeader(0);
        expect(useRequestStore.getState().headers).toEqual([]);
    });

    it('can add, update and remove query param rows', () => {
        const state = useRequestStore.getState();

        state.addQueryParam();
        state.updateQueryParam(0, 'key', 'page');
        state.updateQueryParam(0, 'value', '1');

        expect(useRequestStore.getState().queryParams[0]).toEqual({
            key: 'page',
            value: '1',
            enabled: true,
        });

        state.removeQueryParam(0);
        expect(useRequestStore.getState().queryParams).toEqual([]);
    });

    it('can switch active tab and set raw body', () => {
        const state = useRequestStore.getState();

        state.setActiveTab('body');
        state.setBodyRaw('{"hello":"world"}');

        expect(useRequestStore.getState().activeTab).toBe('body');
        expect(useRequestStore.getState().body.raw).toBe('{"hello":"world"}');
    });

    it('isDirty starts as false', () => {
        expect(useRequestStore.getState().isDirty).toBe(false);
    });

    it('setMethod sets isDirty to true', () => {
        useRequestStore.getState().setMethod('POST');
        expect(useRequestStore.getState().isDirty).toBe(true);
    });

    it('setUrl sets isDirty to true', () => {
        useRequestStore.getState().setUrl('https://example.com');
        expect(useRequestStore.getState().isDirty).toBe(true);
    });

    it('addHeader sets isDirty to true', () => {
        useRequestStore.getState().addHeader();
        expect(useRequestStore.getState().isDirty).toBe(true);
    });

    it('updateHeader sets isDirty to true', () => {
        useRequestStore.getState().addHeader();
        useRequestStore.setState({ isDirty: false });
        useRequestStore.getState().updateHeader(0, 'key', 'X-Token');
        expect(useRequestStore.getState().isDirty).toBe(true);
    });

    it('removeHeader sets isDirty to true', () => {
        useRequestStore.getState().addHeader();
        useRequestStore.setState({ isDirty: false });
        useRequestStore.getState().removeHeader(0);
        expect(useRequestStore.getState().isDirty).toBe(true);
    });

    it('addQueryParam sets isDirty to true', () => {
        useRequestStore.getState().addQueryParam();
        expect(useRequestStore.getState().isDirty).toBe(true);
    });

    it('removeQueryParam sets isDirty to true', () => {
        useRequestStore.getState().addQueryParam();
        useRequestStore.setState({ isDirty: false });
        useRequestStore.getState().removeQueryParam(0);
        expect(useRequestStore.getState().isDirty).toBe(true);
    });

    it('setBodyRaw sets isDirty to true', () => {
        useRequestStore.getState().setBodyRaw('data');
        expect(useRequestStore.getState().isDirty).toBe(true);
    });

    it('markDirty sets isDirty to true by default', () => {
        useRequestStore.getState().markDirty();
        expect(useRequestStore.getState().isDirty).toBe(true);
    });

    it('markDirty(false) sets isDirty to false', () => {
        useRequestStore.setState({ isDirty: true });
        useRequestStore.getState().markDirty(false);
        expect(useRequestStore.getState().isDirty).toBe(false);
    });

    it('loadFromSaved populates all fields and resets isDirty', () => {
        useRequestStore.setState({ isDirty: true });
        const req = makeRequest();
        useRequestStore.getState().loadFromSaved(req);
        const s = useRequestStore.getState();
        expect(s.method).toBe('POST');
        expect(s.url).toBe('https://api.example.com/users');
        expect(s.headers).toEqual([{ key: 'Accept', value: 'application/json', enabled: true }]);
        expect(s.queryParams).toEqual([{ key: 'page', value: '2', enabled: true }]);
        expect(s.body).toEqual({ mode: 'raw', raw: '{"hello":"world"}' });
        expect(s.auth).toEqual({ type: 'none' });
        expect(s.isDirty).toBe(false);
    });

    it('loadFromSaved converts bearer auth_config to AuthState', () => {
        const req = makeRequest({ auth_type: 'bearer', auth_config: { token: 'abc123' } });
        useRequestStore.getState().loadFromSaved(req);
        expect(useRequestStore.getState().auth).toEqual({ type: 'bearer', token: 'abc123' });
    });

    it('loadFromSaved converts basic auth_config to AuthState', () => {
        const req = makeRequest({
            auth_type: 'basic',
            auth_config: { username: 'user', password: 'pass' },
        });
        useRequestStore.getState().loadFromSaved(req);
        expect(useRequestStore.getState().auth).toEqual({
            type: 'basic',
            username: 'user',
            password: 'pass',
        });
    });

    it('loadFromSaved converts api-key auth_config to AuthState', () => {
        const req = makeRequest({
            auth_type: 'api-key',
            auth_config: { key: 'X-API-Key', value: 'secret', in: 'header' },
        });
        useRequestStore.getState().loadFromSaved(req);
        expect(useRequestStore.getState().auth).toEqual({
            type: 'api-key',
            key: 'X-API-Key',
            value: 'secret',
            in: 'header',
        });
    });

    it('loadFromSaved sets body mode from body_type', () => {
        const req = makeRequest({ body_type: 'json', body_content: '{"x":1}' });
        useRequestStore.getState().loadFromSaved(req);
        const { body } = useRequestStore.getState();
        expect(body.mode).toBe('json');
        expect(body.raw).toBe('{"x":1}');
    });

    it('setAuth updates auth state and marks isDirty true', () => {
        const { setAuth } = useRequestStore.getState();
        setAuth({ type: 'bearer', token: 'abc123' });
        const state = useRequestStore.getState();
        expect(state.auth).toEqual({ type: 'bearer', token: 'abc123' });
        expect(state.isDirty).toBe(true);
    });

    it('setAuth with type none sets { type: none } correctly', () => {
        useRequestStore.setState({ auth: { type: 'bearer', token: 'old-token' }, isDirty: false });
        const { setAuth } = useRequestStore.getState();
        setAuth({ type: 'none' });
        const state = useRequestStore.getState();
        expect(state.auth).toEqual({ type: 'none' });
        expect(state.isDirty).toBe(true);
    });
});

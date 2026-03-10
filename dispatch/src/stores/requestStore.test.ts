import { describe, it, expect, beforeEach } from 'vitest';
import { useRequestStore } from './requestStore';

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
});

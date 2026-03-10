import { describe, it, expect, beforeEach } from 'vitest';
import { useRequestStore } from './requestStore';

describe('requestStore', () => {
    beforeEach(() => {
        useRequestStore.setState({ method: 'GET', url: '' });
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
});

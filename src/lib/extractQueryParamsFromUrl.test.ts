import { describe, expect, it } from 'vitest';
import { extractQueryParamsFromUrl } from './extractQueryParamsFromUrl';

describe('extractQueryParamsFromUrl', () => {
    it('parses valid URL query params in order', () => {
        const result = extractQueryParamsFromUrl('https://api.example.com/search?q=boots&page=2');

        expect(result).toEqual({
            ok: true,
            params: [
                { key: 'q', value: 'boots', enabled: true },
                { key: 'page', value: '2', enabled: true },
            ],
        });
    });

    it('returns empty list when URL has no query string', () => {
        const result = extractQueryParamsFromUrl('https://api.example.com/search');

        expect(result).toEqual({ ok: true, params: [] });
    });

    it('preserves repeated keys as separate params', () => {
        const result = extractQueryParamsFromUrl('https://api.example.com/search?tag=a&tag=b');

        expect(result).toEqual({
            ok: true,
            params: [
                { key: 'tag', value: 'a', enabled: true },
                { key: 'tag', value: 'b', enabled: true },
            ],
        });
    });

    it('maps key without explicit value to empty string', () => {
        const result = extractQueryParamsFromUrl('https://api.example.com/search?flag');

        expect(result).toEqual({
            ok: true,
            params: [{ key: 'flag', value: '', enabled: true }],
        });
    });

    it('retries with https prefix when protocol is missing', () => {
        const result = extractQueryParamsFromUrl('api.example.com/search?city=New%20York');

        expect(result).toEqual({
            ok: true,
            params: [{ key: 'city', value: 'New York', enabled: true }],
        });
    });

    it('returns an error result for invalid urls', () => {
        const result = extractQueryParamsFromUrl('http://:bad-url');

        expect(result.ok).toBe(false);
    });
});
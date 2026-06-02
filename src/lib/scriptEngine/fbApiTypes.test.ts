import { describe, it, expect } from 'vitest';
import {
    FB_API_DTS,
    FB_ENV_MEMBERS,
    FB_REQUEST_MEMBERS,
    FB_UTILS_MEMBERS,
} from './fbApiTypes';
import { FB_HTTP_METHODS } from './constants';

/**
 * Drift guard (Story 20.6 AC3): every member exposed by the runtime QuickJS bridges
 * must be documented in FB_API_DTS, so the IntelliSense typings cannot silently fall
 * out of sync with what scripts can actually call.
 */
describe('FB_API_DTS drift guard', () => {
    it('declares the fb global', () => {
        expect(FB_API_DTS).toContain('declare const fb: Fb');
    });

    it('covers every fb.env member', () => {
        for (const m of FB_ENV_MEMBERS) {
            expect(FB_API_DTS).toContain(`${m}(`);
        }
    });

    it('covers every fb.request member', () => {
        for (const m of FB_REQUEST_MEMBERS) {
            expect(FB_API_DTS).toContain(m);
        }
    });

    it('covers every fb.http method (sourced from FB_HTTP_METHODS)', () => {
        for (const m of FB_HTTP_METHODS) {
            expect(FB_API_DTS).toContain(`${m}(url: string`);
        }
    });

    it('covers every fb.utils member', () => {
        for (const m of FB_UTILS_MEMBERS) {
            expect(FB_API_DTS).toContain(`${m}(`);
        }
    });

    it('covers the post-response surface (fb.response + fb.test/fb.expect)', () => {
        expect(FB_API_DTS).toContain('response: FbResponse');
        for (const m of ['status', 'headers', 'body', 'time']) {
            expect(FB_API_DTS).toContain(`readonly ${m}`);
        }
        expect(FB_API_DTS).toContain('test(name: string');
        expect(FB_API_DTS).toContain('expect(actual: unknown)');
    });
});

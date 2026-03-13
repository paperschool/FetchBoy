import { describe, expect, it } from 'vitest';
import { interpolate, unresolvedTokens } from './interpolate';
import type { KeyValuePair } from '@/lib/db';

const enabled = (key: string, value: string): KeyValuePair => ({ key, value, enabled: true });
const disabled = (key: string, value: string): KeyValuePair => ({ key, value, enabled: false });

describe('interpolate', () => {
    it('substitutes a matching enabled variable', () => {
        expect(interpolate('Hello {{NAME}}', [enabled('NAME', 'World')])).toBe('Hello World');
    });

    it('substitutes multiple tokens in one string', () => {
        const vars = [enabled('HOST', 'api.example.com'), enabled('VERSION', 'v2')];
        expect(interpolate('https://{{HOST}}/{{VERSION}}/users', vars)).toBe(
            'https://api.example.com/v2/users',
        );
    });

    it('leaves a disabled variable token unchanged', () => {
        expect(interpolate('https://{{HOST}}/path', [disabled('HOST', 'api.example.com')])).toBe(
            'https://{{HOST}}/path',
        );
    });

    it('leaves a token unchanged when no matching variable exists', () => {
        expect(interpolate('{{UNKNOWN}}', [])).toBe('{{UNKNOWN}}');
    });

    it('returns template unchanged when variables array is empty', () => {
        expect(interpolate('https://{{HOST}}/path', [])).toBe('https://{{HOST}}/path');
    });

    it('replaces duplicate tokens, both occurrences substituted', () => {
        expect(interpolate('{{X}} and {{X}}', [enabled('X', 'foo')])).toBe('foo and foo');
    });

    it('returns plain string unchanged when there are no tokens', () => {
        expect(interpolate('https://api.example.com/path', [enabled('HOST', 'x')])).toBe(
            'https://api.example.com/path',
        );
    });
});

describe('unresolvedTokens', () => {
    it('returns empty array when all tokens are resolved', () => {
        expect(unresolvedTokens('{{A}} {{B}}', [enabled('A', '1'), enabled('B', '2')])).toEqual([]);
    });

    it('returns unresolved key names (deduplicated, sorted alphabetically)', () => {
        expect(unresolvedTokens('{{Z}} {{A}} {{Z}}', [])).toEqual(['A', 'Z']);
    });

    it('treats disabled variables as unresolved', () => {
        expect(unresolvedTokens('{{HOST}}', [disabled('HOST', 'x')])).toEqual(['HOST']);
    });

    it('returns empty array for string with no tokens', () => {
        expect(unresolvedTokens('https://api.example.com/path', [enabled('HOST', 'x')])).toEqual([]);
    });

    it('returns only actually unresolved keys when some are resolved', () => {
        const vars = [enabled('BASE', 'https://x.com')];
        expect(unresolvedTokens('{{BASE}}/{{PATH}}', vars)).toEqual(['PATH']);
    });
});

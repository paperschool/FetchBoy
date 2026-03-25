import { describe, expect, it } from 'vitest';
import { serializeCookie, parseCookieHeader, validateCookie, createEmptyCookie } from './MappingCookieEditor.utils';
import type { MappingCookie } from '@/lib/db';

describe('MappingCookieEditor.utils', () => {
    describe('createEmptyCookie', () => {
        it('returns a cookie with default values', () => {
            const c = createEmptyCookie();
            expect(c.name).toBe('');
            expect(c.path).toBe('/');
            expect(c.sameSite).toBe('Lax');
            expect(c.secure).toBe(false);
        });
    });

    describe('serializeCookie', () => {
        it('serializes a minimal cookie', () => {
            const c: MappingCookie = { name: 'sid', value: 'abc', domain: '', path: '', secure: false, httpOnly: false, sameSite: 'Lax', expires: '' };
            expect(serializeCookie(c)).toBe('sid=abc; SameSite=Lax');
        });

        it('serializes a full cookie', () => {
            const c: MappingCookie = {
                name: 'sid', value: 'abc', domain: '.example.com', path: '/',
                secure: true, httpOnly: true, sameSite: 'Strict',
                expires: 'Thu, 01 Jan 2026 00:00:00 GMT',
            };
            const result = serializeCookie(c);
            expect(result).toContain('sid=abc');
            expect(result).toContain('Domain=.example.com');
            expect(result).toContain('Path=/');
            expect(result).toContain('Secure');
            expect(result).toContain('HttpOnly');
            expect(result).toContain('SameSite=Strict');
            expect(result).toContain('Expires=Thu, 01 Jan 2026 00:00:00 GMT');
        });
    });

    describe('parseCookieHeader', () => {
        it('parses a full Set-Cookie string', () => {
            const c = parseCookieHeader('sid=abc; Domain=.example.com; Path=/; Secure; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 2026 00:00:00 GMT');
            expect(c.name).toBe('sid');
            expect(c.value).toBe('abc');
            expect(c.domain).toBe('.example.com');
            expect(c.path).toBe('/');
            expect(c.secure).toBe(true);
            expect(c.httpOnly).toBe(true);
            expect(c.sameSite).toBe('Lax');
        });

        it('parses a minimal cookie', () => {
            const c = parseCookieHeader('token=xyz');
            expect(c.name).toBe('token');
            expect(c.value).toBe('xyz');
        });
    });

    describe('validateCookie', () => {
        it('returns no errors for valid cookie', () => {
            const c: MappingCookie = { name: 'sid', value: 'abc', domain: '', path: '/', secure: false, httpOnly: false, sameSite: 'Lax', expires: '' };
            expect(validateCookie(c, 0)).toHaveLength(0);
        });

        it('returns error for empty name', () => {
            const c: MappingCookie = { name: '', value: 'abc', domain: '', path: '/', secure: false, httpOnly: false, sameSite: 'Lax', expires: '' };
            const errors = validateCookie(c, 0);
            expect(errors.some((e) => e.field === 'name')).toBe(true);
        });

        it('returns error for empty value', () => {
            const c: MappingCookie = { name: 'sid', value: '', domain: '', path: '/', secure: false, httpOnly: false, sameSite: 'Lax', expires: '' };
            const errors = validateCookie(c, 0);
            expect(errors.some((e) => e.field === 'value')).toBe(true);
        });

        it('returns error when SameSite=None without Secure', () => {
            const c: MappingCookie = { name: 'sid', value: 'abc', domain: '', path: '/', secure: false, httpOnly: false, sameSite: 'None', expires: '' };
            const errors = validateCookie(c, 0);
            expect(errors.some((e) => e.field === 'secure')).toBe(true);
        });

        it('no error when SameSite=None with Secure', () => {
            const c: MappingCookie = { name: 'sid', value: 'abc', domain: '', path: '/', secure: true, httpOnly: false, sameSite: 'None', expires: '' };
            expect(validateCookie(c, 0)).toHaveLength(0);
        });

        it('returns error for invalid expires date', () => {
            const c: MappingCookie = { name: 'sid', value: 'abc', domain: '', path: '/', secure: false, httpOnly: false, sameSite: 'Lax', expires: 'not-a-date' };
            const errors = validateCookie(c, 0);
            expect(errors.some((e) => e.field === 'expires')).toBe(true);
        });

        it('returns error for invalid cookie name chars', () => {
            const c: MappingCookie = { name: 'bad name', value: 'abc', domain: '', path: '/', secure: false, httpOnly: false, sameSite: 'Lax', expires: '' };
            const errors = validateCookie(c, 0);
            expect(errors.some((e) => e.field === 'name' && e.message.includes('invalid'))).toBe(true);
        });
    });
});

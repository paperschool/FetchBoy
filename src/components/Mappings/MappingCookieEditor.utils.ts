import type { MappingCookie } from '@/lib/db';

const DEFAULT_COOKIE: MappingCookie = {
    name: '',
    value: '',
    domain: '',
    path: '/',
    secure: false,
    httpOnly: false,
    sameSite: 'Lax',
    expires: '',
};

export function createEmptyCookie(): MappingCookie {
    return { ...DEFAULT_COOKIE };
}

export function serializeCookie(cookie: MappingCookie): string {
    const parts = [`${cookie.name}=${cookie.value}`];
    if (cookie.domain) parts.push(`Domain=${cookie.domain}`);
    if (cookie.path) parts.push(`Path=${cookie.path}`);
    if (cookie.secure) parts.push('Secure');
    if (cookie.httpOnly) parts.push('HttpOnly');
    if (cookie.sameSite) parts.push(`SameSite=${cookie.sameSite}`);
    if (cookie.expires) parts.push(`Expires=${cookie.expires}`);
    return parts.join('; ');
}

export function parseCookieHeader(header: string): MappingCookie {
    const cookie = { ...DEFAULT_COOKIE };
    const parts = header.split(';').map((p) => p.trim());
    if (parts.length === 0) return cookie;

    const [nameValue, ...attrs] = parts;
    const eqIdx = nameValue.indexOf('=');
    if (eqIdx >= 0) {
        cookie.name = nameValue.slice(0, eqIdx).trim();
        cookie.value = nameValue.slice(eqIdx + 1).trim();
    }

    for (const attr of attrs) {
        const lower = attr.toLowerCase();
        if (lower === 'secure') { cookie.secure = true; continue; }
        if (lower === 'httponly') { cookie.httpOnly = true; continue; }
        const [key, ...valParts] = attr.split('=');
        const val = valParts.join('=').trim();
        const keyLower = key.trim().toLowerCase();
        if (keyLower === 'domain') cookie.domain = val;
        else if (keyLower === 'path') cookie.path = val;
        else if (keyLower === 'samesite') {
            const normalized = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
            if (normalized === 'Strict' || normalized === 'Lax' || normalized === 'None') {
                cookie.sameSite = normalized;
            }
        } else if (keyLower === 'expires') cookie.expires = val;
    }
    return cookie;
}

export interface CookieValidationError {
    index: number;
    field: string;
    message: string;
}

export function validateCookie(cookie: MappingCookie, index: number): CookieValidationError[] {
    const errors: CookieValidationError[] = [];
    if (!cookie.name.trim()) errors.push({ index, field: 'name', message: 'Cookie name is required' });
    else if (!/^[\w!#$%&'*+\-.^`|~]+$/.test(cookie.name)) {
        errors.push({ index, field: 'name', message: 'Cookie name contains invalid characters' });
    }
    if (!cookie.value.trim()) errors.push({ index, field: 'value', message: 'Cookie value is required' });
    if (cookie.sameSite === 'None' && !cookie.secure) {
        errors.push({ index, field: 'secure', message: 'SameSite=None requires Secure' });
    }
    if (cookie.expires) {
        const d = new Date(cookie.expires);
        if (isNaN(d.getTime())) errors.push({ index, field: 'expires', message: 'Invalid date' });
    }
    return errors;
}

export function validateAllCookies(cookies: MappingCookie[]): CookieValidationError[] {
    return cookies.flatMap((c, i) => validateCookie(c, i));
}

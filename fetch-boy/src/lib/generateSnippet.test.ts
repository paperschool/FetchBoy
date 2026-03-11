import { describe, it, expect } from 'vitest';
import { generateSnippet, type ResolvedRequest } from './generateSnippet';

// ---------------------------------------------------------------------------
// Base fixture
// ---------------------------------------------------------------------------

const baseRequest: ResolvedRequest = {
    method: 'POST',
    url: 'https://api.example.com/users',
    headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
    queryParams: [{ key: 'page', value: '1', enabled: true }],
    body: { mode: 'json', raw: '{"name":"Alice"}' },
    auth: { type: 'none' },
};

// ---------------------------------------------------------------------------
// cURL
// ---------------------------------------------------------------------------

describe('generateSnippet — cURL', () => {
    it('starts with curl -X POST', () => {
        const out = generateSnippet('curl', baseRequest);
        expect(out).toMatch(/^curl -X POST/);
    });

    it('contains the URL with ?page=1', () => {
        const out = generateSnippet('curl', baseRequest);
        expect(out).toContain('https://api.example.com/users?page=1');
    });

    it('contains -H Content-Type header', () => {
        const out = generateSnippet('curl', baseRequest);
        expect(out).toContain("-H 'Content-Type: application/json'");
    });

    it('contains -d with body', () => {
        const out = generateSnippet('curl', baseRequest);
        expect(out).toContain("-d '{\"name\":\"Alice\"}'");
    });

    it('does NOT contain -d when body mode is none', () => {
        const req: ResolvedRequest = { ...baseRequest, body: { mode: 'none', raw: '' } };
        const out = generateSnippet('curl', req);
        expect(out).not.toContain('-d');
    });

    it('does NOT contain -d when body.raw is empty after trim', () => {
        const req: ResolvedRequest = { ...baseRequest, body: { mode: 'raw', raw: '   ' } };
        const out = generateSnippet('curl', req);
        expect(out).not.toContain('-d');
    });
});

// ---------------------------------------------------------------------------
// Python (requests)
// ---------------------------------------------------------------------------

describe('generateSnippet — Python', () => {
    it('starts with import requests', () => {
        const out = generateSnippet('python', baseRequest);
        expect(out).toContain('import requests');
    });

    it('calls requests.post(', () => {
        const out = generateSnippet('python', baseRequest);
        expect(out).toContain('requests.post(');
    });

    it('contains Content-Type header', () => {
        const out = generateSnippet('python', baseRequest);
        expect(out).toContain('"Content-Type": "application/json"');
    });

    it('contains params with page', () => {
        const out = generateSnippet('python', baseRequest);
        expect(out).toContain('"page": "1"');
    });

    it('does NOT contain data= when body mode is none', () => {
        const req: ResolvedRequest = { ...baseRequest, body: { mode: 'none', raw: '' } };
        const out = generateSnippet('python', req);
        expect(out).not.toContain('data=');
    });
});

// ---------------------------------------------------------------------------
// JavaScript (fetch)
// ---------------------------------------------------------------------------

describe('generateSnippet — JavaScript (fetch)', () => {
    it('contains await fetch(', () => {
        const out = generateSnippet('javascript', baseRequest);
        expect(out).toContain('await fetch(');
    });

    it('contains method: POST', () => {
        const out = generateSnippet('javascript', baseRequest);
        expect(out).toContain("method: 'POST'");
    });

    it('contains Content-Type header', () => {
        const out = generateSnippet('javascript', baseRequest);
        expect(out).toContain("'Content-Type': 'application/json'");
    });

    it('URL contains baked-in query params', () => {
        const out = generateSnippet('javascript', baseRequest);
        expect(out).toContain('?page=1');
    });
});

// ---------------------------------------------------------------------------
// Node.js (axios)
// ---------------------------------------------------------------------------

describe('generateSnippet — Node.js (axios)', () => {
    it('contains require(axios)', () => {
        const out = generateSnippet('nodejs', baseRequest);
        expect(out).toContain("require('axios')");
    });

    it('uses lowercase method', () => {
        const out = generateSnippet('nodejs', baseRequest);
        expect(out).toContain("method: 'post'");
    });

    it('contains Content-Type header', () => {
        const out = generateSnippet('nodejs', baseRequest);
        expect(out).toContain("'Content-Type': 'application/json'");
    });

    it('contains params: block', () => {
        const out = generateSnippet('nodejs', baseRequest);
        expect(out).toContain('params:');
    });
});

// ---------------------------------------------------------------------------
// Auth injection
// ---------------------------------------------------------------------------

describe('generateSnippet — Bearer auth', () => {
    const req: ResolvedRequest = { ...baseRequest, auth: { type: 'bearer', token: 'tok123' } };

    it('cURL includes Authorization: Bearer tok123', () => {
        const out = generateSnippet('curl', req);
        expect(out).toContain("-H 'Authorization: Bearer tok123'");
    });

    it('Python includes Authorization: Bearer tok123', () => {
        const out = generateSnippet('python', req);
        expect(out).toContain('"Authorization": "Bearer tok123"');
    });

    it('JavaScript includes Authorization: Bearer tok123', () => {
        const out = generateSnippet('javascript', req);
        expect(out).toContain("'Authorization': 'Bearer tok123'");
    });

    it('axios includes Authorization: Bearer tok123', () => {
        const out = generateSnippet('nodejs', req);
        expect(out).toContain("'Authorization': 'Bearer tok123'");
    });
});

describe('generateSnippet — Basic auth', () => {
    const req: ResolvedRequest = {
        ...baseRequest,
        auth: { type: 'basic', username: 'user', password: 'pass' },
    };
    // btoa('user:pass') = 'dXNlcjpwYXNz'

    it('cURL output contains Basic dXNlcjpwYXNz', () => {
        const out = generateSnippet('curl', req);
        expect(out).toContain('Authorization: Basic dXNlcjpwYXNz');
    });

    it('Python output contains Basic dXNlcjpwYXNz', () => {
        const out = generateSnippet('python', req);
        expect(out).toContain('Authorization": "Basic dXNlcjpwYXNz');
    });
});

describe('generateSnippet — API Key auth in header', () => {
    const req: ResolvedRequest = {
        ...baseRequest,
        auth: { type: 'api-key', key: 'X-Api-Key', value: 'secret', in: 'header' },
    };

    it('cURL output contains X-Api-Key: secret header', () => {
        const out = generateSnippet('curl', req);
        expect(out).toContain("-H 'X-Api-Key: secret'");
    });

    it('Python output contains X-Api-Key header', () => {
        const out = generateSnippet('python', req);
        expect(out).toContain('"X-Api-Key": "secret"');
    });
});

describe('generateSnippet — API Key auth in query', () => {
    const req: ResolvedRequest = {
        ...baseRequest,
        auth: { type: 'api-key', key: 'apikey', value: 'secret', in: 'query' },
    };

    it('URL contains apikey=secret param', () => {
        const out = generateSnippet('curl', req);
        expect(out).toContain('apikey=secret');
    });

    it('no Authorization header added', () => {
        const out = generateSnippet('curl', req);
        expect(out).not.toContain("-H 'Authorization:");
    });
});

// ---------------------------------------------------------------------------
// Disabled headers filtered out
// ---------------------------------------------------------------------------

describe('generateSnippet — disabled headers', () => {
    const req: ResolvedRequest = {
        ...baseRequest,
        headers: [
            { key: 'Content-Type', value: 'application/json', enabled: true },
            { key: 'X-Secret', value: 'hidden', enabled: false },
        ],
    };

    it('disabled header is absent from cURL snippet', () => {
        const out = generateSnippet('curl', req);
        expect(out).not.toContain('X-Secret');
    });

    it('disabled header is absent from Python snippet', () => {
        const out = generateSnippet('python', req);
        expect(out).not.toContain('X-Secret');
    });
});

// ---------------------------------------------------------------------------
// No trailing whitespace
// ---------------------------------------------------------------------------

describe('generateSnippet — no trailing whitespace', () => {
    const formats = ['curl', 'python', 'javascript', 'nodejs'] as const;

    for (const format of formats) {
        it(`${format}: every line has no trailing whitespace`, () => {
            const out = generateSnippet(format, baseRequest);
            const lines = out.split('\n');
            for (const line of lines) {
                expect(line).toBe(line.trimEnd());
            }
        });
    }
});

import { describe, it, expect } from 'vitest';
import { executePreRequestScript, type ScriptContext, type HttpSender } from './index';

const makeContext = (overrides: Partial<ScriptContext> = {}): ScriptContext => ({
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    queryParams: [{ key: 'page', value: '1', enabled: true }],
    body: '',
    envVars: { BASE_URL: 'https://api.example.com', TOKEN: 'abc123' },
    ...overrides,
});

describe('executePreRequestScript', () => {
    it('returns unmodified state for empty script', async () => {
        const ctx = makeContext();
        const result = await executePreRequestScript('// no-op', ctx);
        expect(result.url).toBe(ctx.url);
        expect(result.headers).toEqual(ctx.headers);
        expect(result.queryParams).toEqual(ctx.queryParams);
        expect(result.body).toBe(ctx.body);
        expect(result.envMutations).toEqual({});
        expect(result.consoleLogs).toEqual([]);
        expect(result.httpLogs).toEqual([]);
    });

    it('allows modifying the request URL', async () => {
        const ctx = makeContext();
        const result = await executePreRequestScript(
            'fb.request.url = "https://new-url.com/api";',
            ctx,
        );
        expect(result.url).toBe('https://new-url.com/api');
    });

    it('allows reading the HTTP method', async () => {
        const ctx = makeContext({ method: 'POST' });
        const result = await executePreRequestScript(
            'if (fb.request.method === "POST") fb.request.url = "https://post-url.com";',
            ctx,
        );
        expect(result.url).toBe('https://post-url.com');
    });

    it('allows modifying request headers', async () => {
        const ctx = makeContext();
        const result = await executePreRequestScript(
            'fb.request.headers = [{ key: "X-Custom", value: "test", enabled: true }];',
            ctx,
        );
        expect(result.headers).toEqual([{ key: 'X-Custom', value: 'test', enabled: true }]);
    });

    it('allows modifying query params', async () => {
        const ctx = makeContext();
        const result = await executePreRequestScript(
            'fb.request.queryParams = [{ key: "limit", value: "50", enabled: true }];',
            ctx,
        );
        expect(result.queryParams).toEqual([{ key: 'limit', value: '50', enabled: true }]);
    });

    it('allows modifying the request body', async () => {
        const ctx = makeContext({ body: '{}' });
        const result = await executePreRequestScript(
            'fb.request.body = JSON.stringify({ name: "test" });',
            ctx,
        );
        expect(result.body).toBe('{"name":"test"}');
    });

    describe('fb.env', () => {
        it('reads existing env variables', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'fb.request.url = fb.env.get("BASE_URL") + "/test";',
                ctx,
            );
            expect(result.url).toBe('https://api.example.com/test');
        });

        it('returns undefined for non-existent env variables', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'if (fb.env.get("NONEXISTENT") === undefined) fb.request.url = "ok";',
                ctx,
            );
            expect(result.url).toBe('ok');
        });

        it('sets env variables and reports mutations', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'fb.env.set("NEW_VAR", "hello");',
                ctx,
            );
            expect(result.envMutations).toEqual({ NEW_VAR: 'hello' });
        });

        it('reports changed env variables as mutations', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'fb.env.set("TOKEN", "new-token");',
                ctx,
            );
            expect(result.envMutations).toEqual({ TOKEN: 'new-token' });
        });

        it('does not report unchanged env variables', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'fb.env.set("TOKEN", "abc123");', // same value
                ctx,
            );
            expect(result.envMutations).toEqual({});
        });
    });

    describe('fb.utils', () => {
        it('generates a UUID v4', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'fb.request.body = fb.utils.uuid();',
                ctx,
            );
            expect(result.body).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
            );
        });

        it('returns a Unix timestamp in seconds', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'fb.request.body = String(fb.utils.timestamp());',
                ctx,
            );
            const ts = parseInt(result.body, 10);
            expect(ts).toBeGreaterThan(1700000000);
            expect(ts).toBeLessThan(2000000000);
        });

        it('returns a Unix timestamp in milliseconds', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'fb.request.body = String(fb.utils.timestampMs());',
                ctx,
            );
            const ts = parseInt(result.body, 10);
            expect(ts).toBeGreaterThan(1700000000000);
        });

        it('base64 encodes and decodes', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                `
                const encoded = fb.utils.base64Encode("hello world");
                const decoded = fb.utils.base64Decode(encoded);
                fb.request.body = decoded;
                `,
                ctx,
            );
            expect(result.body).toBe('hello world');
        });

        it('computes sha256 hash', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'fb.request.body = fb.utils.sha256("hello");',
                ctx,
            );
            expect(result.body).toBe(
                '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
            );
        });

        it('computes hmacSha256', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'fb.request.body = fb.utils.hmacSha256("key", "message");',
                ctx,
            );
            expect(result.body).toHaveLength(64);
            expect(result.body).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    describe('console capture', () => {
        it('captures console.log output', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'console.log("hello", "world");',
                ctx,
            );
            expect(result.consoleLogs).toHaveLength(1);
            expect(result.consoleLogs[0].level).toBe('log');
            expect(result.consoleLogs[0].args).toContain('hello');
            expect(result.consoleLogs[0].args).toContain('world');
            expect(result.consoleLogs[0].timestamp).toBeGreaterThan(0);
        });

        it('captures console.warn and console.error', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'console.warn("caution"); console.error("bad");',
                ctx,
            );
            expect(result.consoleLogs).toHaveLength(2);
            expect(result.consoleLogs[0].level).toBe('warn');
            expect(result.consoleLogs[0].args).toContain('caution');
            expect(result.consoleLogs[1].level).toBe('error');
            expect(result.consoleLogs[1].args).toContain('bad');
        });

        it('captures multiple console calls', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                'for (let i = 0; i < 3; i++) console.log("item " + i);',
                ctx,
            );
            expect(result.consoleLogs).toHaveLength(3);
        });
    });

    describe('fb.http', () => {
        const mockSender: HttpSender = async (method, url) => ({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: 'test-bearer-token', method, url }),
        });

        it('makes a GET request and uses response to set env var', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                `
                var res = fb.http.get("https://auth.example.com/token");
                var data = JSON.parse(res.body);
                fb.env.set("BEARER", data.token);
                `,
                ctx,
                { httpSender: mockSender },
            );
            expect(result.envMutations).toEqual({ BEARER: 'test-bearer-token' });
            expect(result.httpLogs).toHaveLength(1);
            expect(result.httpLogs[0].method).toBe('GET');
            expect(result.httpLogs[0].url).toBe('https://auth.example.com/token');
            expect(result.httpLogs[0].status).toBe(200);
        });

        it('makes a POST request with body', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                `
                var res = fb.http.post("https://api.example.com/login", {
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user: "test" }),
                });
                fb.request.body = res.body;
                `,
                ctx,
                { httpSender: mockSender },
            );
            const body = JSON.parse(result.body);
            expect(body.method).toBe('POST');
            expect(result.httpLogs).toHaveLength(1);
            expect(result.httpLogs[0].method).toBe('POST');
        });

        it('logs HTTP sub-requests', async () => {
            const ctx = makeContext();
            const result = await executePreRequestScript(
                `
                fb.http.get("https://a.com");
                fb.http.post("https://b.com");
                fb.http.put("https://c.com");
                `,
                ctx,
                { httpSender: mockSender },
            );
            expect(result.httpLogs).toHaveLength(3);
            expect(result.httpLogs.map(l => l.method)).toEqual(['GET', 'POST', 'PUT']);
        });

        it('handles HTTP errors gracefully', async () => {
            const failingSender: HttpSender = async () => {
                throw new Error('Network error');
            };
            const ctx = makeContext();
            await expect(
                executePreRequestScript(
                    'fb.http.get("https://failing.com");',
                    ctx,
                    { httpSender: failingSender },
                ),
            ).rejects.toMatchObject({
                message: expect.stringContaining(''),
            });
        });

        it('errors when no httpSender provided', async () => {
            const ctx = makeContext();
            await expect(
                executePreRequestScript(
                    'fb.http.get("https://example.com");',
                    ctx,
                ),
            ).rejects.toMatchObject({
                message: expect.stringContaining(''),
            });
        });
    });

    describe('env integration with http', () => {
        it('script sets env var from HTTP response, next request resolves it', async () => {
            const mockSender: HttpSender = async () => ({
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: 'fresh-token-123' }),
            });
            const ctx = makeContext({ envVars: { API_KEY: 'old' } });
            const result = await executePreRequestScript(
                `
                var res = fb.http.get("https://auth.example.com/token");
                var data = JSON.parse(res.body);
                fb.env.set("API_KEY", data.token);
                fb.request.headers = [{ key: "Authorization", value: "Bearer " + fb.env.get("API_KEY"), enabled: true }];
                `,
                ctx,
                { httpSender: mockSender },
            );
            expect(result.envMutations).toEqual({ API_KEY: 'fresh-token-123' });
            expect(result.headers).toEqual([
                { key: 'Authorization', value: 'Bearer fresh-token-123', enabled: true },
            ]);
            expect(result.httpLogs).toHaveLength(1);
        });
    });

    describe('error handling', () => {
        it('throws a ScriptError for syntax errors', async () => {
            const ctx = makeContext();
            await expect(
                executePreRequestScript('if (', ctx),
            ).rejects.toMatchObject({
                message: expect.stringContaining(''),
            });
        });

        it('throws a ScriptError for runtime errors', async () => {
            const ctx = makeContext();
            await expect(
                executePreRequestScript('throw new Error("boom");', ctx),
            ).rejects.toMatchObject({
                message: expect.stringContaining('boom'),
            });
        });
    });
});

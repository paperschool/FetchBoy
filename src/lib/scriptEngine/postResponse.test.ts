import { describe, it, expect } from 'vitest';
import { executePostResponseScript, type PostResponseContext } from './index';

const makeCtx = (overrides: Partial<PostResponseContext> = {}): PostResponseContext => ({
    response: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 7, name: 'Ada' }),
        time: 42,
    },
    envVars: { TOKEN: 'abc' },
    ...overrides,
});

describe('executePostResponseScript', () => {
    it('exposes a read-only fb.response', async () => {
        const result = await executePostResponseScript(
            `
            fb.test("status is 200", function () { fb.expect(fb.response.status).toBe(200); });
            fb.test("body has name", function () { fb.expect(fb.response.body).toContain("Ada"); });
            fb.test("time is fast", function () { fb.expect(fb.response.time).toBeGreaterThan(0); });
            `,
            makeCtx(),
        );
        expect(result.testResults).toHaveLength(3);
        expect(result.testResults.every((t) => t.passed)).toBe(true);
    });

    it('records a failing fb.test without throwing past the sandbox', async () => {
        const result = await executePostResponseScript(
            `
            fb.test("wrong status", function () { fb.expect(fb.response.status).toBe(404); });
            fb.test("right status", function () { fb.expect(fb.response.status).toBe(200); });
            `,
            makeCtx(),
        );
        expect(result.testResults).toHaveLength(2);
        const failing = result.testResults.find((t) => t.name === 'wrong status');
        expect(failing?.passed).toBe(false);
        expect(failing?.error).toContain('404');
        expect(result.testResults.find((t) => t.name === 'right status')?.passed).toBe(true);
    });

    it('persists fb.env.set as an env mutation', async () => {
        const result = await executePostResponseScript(
            `
            var data = JSON.parse(fb.response.body);
            fb.env.set("USER_ID", String(data.id));
            `,
            makeCtx(),
        );
        expect(result.envMutations).toEqual({ USER_ID: '7' });
    });

    it('does not report unchanged env vars', async () => {
        const result = await executePostResponseScript('fb.env.set("TOKEN", "abc");', makeCtx());
        expect(result.envMutations).toEqual({});
    });

    it('captures console output', async () => {
        const result = await executePostResponseScript('console.log("post", fb.response.status);', makeCtx());
        expect(result.consoleLogs).toHaveLength(1);
        expect(result.consoleLogs[0].args).toContain('post');
    });

    it('a no-op script yields no tests, no mutations', async () => {
        const result = await executePostResponseScript('// nothing', makeCtx());
        expect(result.testResults).toEqual([]);
        expect(result.envMutations).toEqual({});
    });

    it('throws a ScriptError for a script that throws outside fb.test', async () => {
        await expect(
            executePostResponseScript('throw new Error("boom");', makeCtx()),
        ).rejects.toMatchObject({ message: expect.stringContaining('boom') });
    });
});

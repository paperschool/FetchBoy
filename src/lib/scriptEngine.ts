import { getQuickJS, type QuickJSContext, type QuickJSHandle } from 'quickjs-emscripten';
import type { KeyValuePair } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScriptContext {
    url: string;
    method: string;
    headers: KeyValuePair[];
    queryParams: KeyValuePair[];
    body: string;
    envVars: Record<string, string>;
}

export interface ScriptResult {
    url: string;
    headers: KeyValuePair[];
    queryParams: KeyValuePair[];
    body: string;
    envMutations: Record<string, string>;
}

export interface ScriptError {
    message: string;
    lineNumber?: number;
}

const TIMEOUT_MS = 5_000;

// ─── fb API Bridge ───────────────────────────────────────────────────────────

function injectFbApi(ctx: QuickJSContext, input: ScriptContext): void {
    const fb = ctx.newObject();

    // fb.env
    const envObj = ctx.newObject();
    const envStore = { ...input.envVars };

    const envGet = ctx.newFunction('get', (keyHandle) => {
        const key = ctx.getString(keyHandle);
        const val = envStore[key];
        return val !== undefined ? ctx.newString(val) : ctx.undefined;
    });
    ctx.setProp(envObj, 'get', envGet);
    envGet.dispose();

    const envSet = ctx.newFunction('set', (keyHandle, valHandle) => {
        const key = ctx.getString(keyHandle);
        const val = ctx.getString(valHandle);
        envStore[key] = val;
        return ctx.undefined;
    });
    ctx.setProp(envObj, 'set', envSet);
    envSet.dispose();

    ctx.setProp(fb, 'env', envObj);
    envObj.dispose();

    // fb.request — stored as JSON in a global, read back after execution
    const initScript = `
        globalThis.__fb_request = ${JSON.stringify({
            url: input.url,
            method: input.method,
            headers: input.headers,
            queryParams: input.queryParams,
            body: input.body,
        })};
        globalThis.__fb_env_store = ${JSON.stringify(envStore)};
    `;
    const initResult = ctx.evalCode(initScript);
    if (initResult.error) {
        const err = ctx.dump(initResult.error);
        initResult.error.dispose();
        throw new Error(`Script init error: ${String(err)}`);
    }
    initResult.value.dispose();

    // Proxy-like request object via evalCode
    const requestScript = `
        (function() {
            const req = globalThis.__fb_request;
            return {
                get url() { return req.url; },
                set url(v) { req.url = v; },
                get method() { return req.method; },
                get headers() { return req.headers; },
                set headers(v) { req.headers = v; },
                get queryParams() { return req.queryParams; },
                set queryParams(v) { req.queryParams = v; },
                get body() { return req.body; },
                set body(v) { req.body = v; },
            };
        })()
    `;
    const reqResult = ctx.evalCode(requestScript);
    if (reqResult.error) {
        const err = ctx.dump(reqResult.error);
        reqResult.error.dispose();
        throw new Error(`Request proxy init error: ${String(err)}`);
    }
    ctx.setProp(fb, 'request', reqResult.value);
    reqResult.value.dispose();

    // fb.utils
    const utils = ctx.newObject();

    registerUtil(ctx, utils, 'uuid', () => ctx.newString(crypto.randomUUID()));

    registerUtil(ctx, utils, 'timestamp', () =>
        ctx.newNumber(Math.floor(Date.now() / 1000)));

    registerUtil(ctx, utils, 'timestampMs', () =>
        ctx.newNumber(Date.now()));

    registerUtil(ctx, utils, 'base64Encode', (strHandle) => {
        const str = ctx.getString(strHandle);
        return ctx.newString(btoa(str));
    });

    registerUtil(ctx, utils, 'base64Decode', (strHandle) => {
        const str = ctx.getString(strHandle);
        return ctx.newString(atob(str));
    });

    registerUtil(ctx, utils, 'sha256', (strHandle) => {
        const str = ctx.getString(strHandle);
        const hash = sha256Sync(str);
        return ctx.newString(hash);
    });

    registerUtil(ctx, utils, 'hmacSha256', (keyHandle, strHandle) => {
        const key = ctx.getString(keyHandle);
        const str = ctx.getString(strHandle);
        const hash = hmacSha256Sync(key, str);
        return ctx.newString(hash);
    });

    ctx.setProp(fb, 'utils', utils);
    utils.dispose();

    // Attach fb to global
    const global = ctx.global;
    ctx.setProp(global, 'fb', fb);
    fb.dispose();
    global.dispose();
}

function registerUtil(
    ctx: QuickJSContext,
    parent: QuickJSHandle,
    name: string,
    fn: (...args: QuickJSHandle[]) => QuickJSHandle,
): void {
    const handle = ctx.newFunction(name, fn);
    ctx.setProp(parent, name, handle);
    handle.dispose();
}

// ─── Crypto Helpers ──────────────────────────────────────────────────────────
// Tauri apps run in a webview backed by a real browser engine on desktop,
// but the jsdom test environment lacks SubtleCrypto. Node's built-in `crypto`
// module is available in both environments and provides synchronous hashing.

import { createHash, createHmac } from 'crypto';

function sha256Sync(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

function hmacSha256Sync(key: string, message: string): string {
    return createHmac('sha256', key).update(message).digest('hex');
}

// ─── Extract Results from Sandbox ────────────────────────────────────────────

function extractResults(ctx: QuickJSContext, input: ScriptContext): ScriptResult {
    const extractCode = `JSON.stringify(globalThis.__fb_request)`;
    const extractResult = ctx.evalCode(extractCode);
    if (extractResult.error) {
        const err = ctx.dump(extractResult.error);
        extractResult.error.dispose();
        throw new Error(`Failed to extract results: ${String(err)}`);
    }
    const resultJson = ctx.getString(extractResult.value);
    extractResult.value.dispose();

    const modified = JSON.parse(resultJson) as {
        url: string;
        headers: KeyValuePair[];
        queryParams: KeyValuePair[];
        body: string;
    };

    // Extract env mutations via fb.env.get bridge
    const envExtractCode = `JSON.stringify(globalThis.__fb_env_store)`;
    const envResult = ctx.evalCode(envExtractCode);
    let envMutations: Record<string, string> = {};
    if (envResult.error) {
        envResult.error.dispose();
    } else {
        const allEnv = JSON.parse(ctx.getString(envResult.value)) as Record<string, string>;
        envResult.value.dispose();
        // Find mutations: new or changed values
        for (const [key, value] of Object.entries(allEnv)) {
            if (input.envVars[key] !== value) {
                envMutations[key] = value;
            }
        }
    }

    return {
        url: modified.url,
        headers: modified.headers,
        queryParams: modified.queryParams,
        body: modified.body,
        envMutations,
    };
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

export async function executePreRequestScript(
    script: string,
    context: ScriptContext,
): Promise<ScriptResult> {
    const QuickJS = await getQuickJS();
    const runtime = QuickJS.newRuntime();
    runtime.setInterruptHandler(() => {
        if (Date.now() - startTime > TIMEOUT_MS) return true;
        return false;
    });

    const startTime = Date.now();
    const ctx = runtime.newContext();

    try {
        // Wire env.set to also update the __fb_env_store global
        const envSetupScript = `
            globalThis.__fb_env_mutations = {};
        `;
        const setupResult = ctx.evalCode(envSetupScript);
        if (setupResult.error) setupResult.error.dispose();
        else setupResult.value.dispose();

        injectFbApi(ctx, context);

        // Override env.set to update __fb_env_store
        const envSetOverride = `
            (function() {
                const origSet = fb.env.set;
                fb.env.set = function(key, value) {
                    globalThis.__fb_env_store[key] = value;
                    return origSet(key, value);
                };
                const origGet = fb.env.get;
                fb.env.get = function(key) {
                    const val = globalThis.__fb_env_store[key];
                    return val !== undefined ? val : undefined;
                };
            })()
        `;
        const overrideResult = ctx.evalCode(envSetOverride);
        if (overrideResult.error) {
            overrideResult.error.dispose();
        } else {
            overrideResult.value.dispose();
        }

        const result = ctx.evalCode(script, 'pre-request-script.js');
        if (result.error) {
            const errorVal = ctx.dump(result.error);
            result.error.dispose();
            const message = typeof errorVal === 'object' && errorVal?.message
                ? String(errorVal.message)
                : String(errorVal);
            const lineMatch = message.match(/line (\d+)/i) ?? String(errorVal).match(/:(\d+)\b/);
            const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
            throw { message, lineNumber } as ScriptError;
        }
        result.value.dispose();

        return extractResults(ctx, context);
    } finally {
        ctx.dispose();
        runtime.dispose();
    }
}

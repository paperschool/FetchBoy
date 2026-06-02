import type { QuickJSAsyncContext, QuickJSHandle } from 'quickjs-emscripten';
import { sha256 } from 'js-sha256';
import type {
  ScriptContext, ConsoleLogEntry, HttpLogEntry, HttpSender,
  ResponseSnapshotForScript, PostResponseResult, TestResult,
} from './types';
import { injectFbHttp } from './fbHttpBridge';

// ─── Console Capture ────────────────────────────────────────────────────────

export function injectConsole(
  ctx: QuickJSAsyncContext,
  logs: ConsoleLogEntry[],
): void {
  const consoleObj = ctx.newObject();
  for (const level of ['log', 'warn', 'error'] as const) {
    const fn = ctx.newFunction(level, (...args: QuickJSHandle[]) => {
      const parts = args.map((a) => {
        try { return JSON.stringify(ctx.dump(a)); }
        catch { return ctx.getString(a); }
      });
      logs.push({ level, args: parts.join(' '), timestamp: Date.now() });
    });
    ctx.setProp(consoleObj, level, fn);
    fn.dispose();
  }
  ctx.setProp(ctx.global, 'console', consoleObj);
  consoleObj.dispose();
}

// ─── fb.env Bridge ──────────────────────────────────────────────────────────

function injectFbEnv(
  ctx: QuickJSAsyncContext,
  fb: QuickJSHandle,
  envStore: Record<string, string>,
): void {
  const envObj = ctx.newObject();

  const envGet = ctx.newFunction('get', (keyHandle: QuickJSHandle) => {
    const key = ctx.getString(keyHandle);
    const val = envStore[key];
    return val !== undefined ? ctx.newString(val) : ctx.undefined;
  });
  ctx.setProp(envObj, 'get', envGet);
  envGet.dispose();

  const envSet = ctx.newFunction('set', (keyHandle: QuickJSHandle, valHandle: QuickJSHandle) => {
    envStore[ctx.getString(keyHandle)] = ctx.getString(valHandle);
    return ctx.undefined;
  });
  ctx.setProp(envObj, 'set', envSet);
  envSet.dispose();

  ctx.setProp(fb, 'env', envObj);
  envObj.dispose();
}

// ─── fb.utils Bridge ────────────────────────────────────────────────────────

function injectFbUtils(ctx: QuickJSAsyncContext, fb: QuickJSHandle): void {
  const utils = ctx.newObject();
  const reg = (name: string, fn: (...args: QuickJSHandle[]) => QuickJSHandle) => {
    const h = ctx.newFunction(name, fn);
    ctx.setProp(utils, name, h);
    h.dispose();
  };

  reg('uuid', () => ctx.newString(crypto.randomUUID()));
  reg('timestamp', () => ctx.newNumber(Math.floor(Date.now() / 1000)));
  reg('timestampMs', () => ctx.newNumber(Date.now()));
  reg('base64Encode', (s) => ctx.newString(btoa(ctx.getString(s))));
  reg('base64Decode', (s) => ctx.newString(atob(ctx.getString(s))));
  reg('sha256', (s) => ctx.newString(sha256(ctx.getString(s))));
  reg('hmacSha256', (k, s) =>
    ctx.newString(sha256.hmac(ctx.getString(k), ctx.getString(s))));

  ctx.setProp(fb, 'utils', utils);
  utils.dispose();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function evalOrThrow(ctx: QuickJSAsyncContext, code: string, label: string): QuickJSHandle {
  const result = ctx.evalCode(code);
  if (result.error) {
    const err = ctx.dump(result.error);
    result.error.dispose();
    throw new Error(`${label}: ${String(err)}`);
  }
  return result.value;
}

// ─── fb.request Init ────────────────────────────────────────────────────────

function injectFbRequest(ctx: QuickJSAsyncContext, fb: QuickJSHandle, input: ScriptContext): void {
  const initScript = `
    globalThis.__fb_request = ${JSON.stringify({
      url: input.url, method: input.method, headers: input.headers,
      queryParams: input.queryParams, body: input.body,
    })};
    globalThis.__fb_env_store = ${JSON.stringify(input.envVars)};
  `;
  evalOrThrow(ctx, initScript, 'Script init error').dispose();

  const requestScript = `(function() {
    const req = globalThis.__fb_request;
    return {
      get url() { return req.url; }, set url(v) { req.url = v; },
      get method() { return req.method; },
      get headers() { return req.headers; }, set headers(v) { req.headers = v; },
      get queryParams() { return req.queryParams; }, set queryParams(v) { req.queryParams = v; },
      get body() { return req.body; }, set body(v) { req.body = v; },
    };
  })()`;
  const reqHandle = evalOrThrow(ctx, requestScript, 'Request proxy init error');
  ctx.setProp(fb, 'request', reqHandle);
  reqHandle.dispose();
}

// ─── Main Injector ──────────────────────────────────────────────────────────

export interface InjectFbApiOptions {
  ctx: QuickJSAsyncContext;
  input: ScriptContext;
  httpLogs: HttpLogEntry[];
  httpSender?: HttpSender;
}

export function injectFbApi(options: InjectFbApiOptions): Record<string, string> {
  const { ctx, input, httpLogs, httpSender } = options;
  const envStore = { ...input.envVars };
  const fb = ctx.newObject();

  injectFbEnv(ctx, fb, envStore);
  injectFbUtils(ctx, fb);
  injectFbHttp(ctx, fb, httpLogs, httpSender);
  injectFbRequest(ctx, fb, input);

  ctx.setProp(ctx.global, 'fb', fb);
  fb.dispose();

  // Override env to sync with __fb_env_store
  const overrideScript = `(function() {
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
  })()`;
  evalOrThrow(ctx, overrideScript, 'Env override error').dispose();

  return envStore;
}

// ─── fb post-response API (fb.response + fb.test/fb.expect) ───────────────────

export interface InjectFbPostResponseOptions {
  ctx: QuickJSAsyncContext;
  response: ResponseSnapshotForScript;
  envVars: Record<string, string>;
}

/**
 * Sets up the post-response sandbox: read-only `fb.response`, `fb.env` (synced to
 * __fb_env_store), `fb.utils`, `console`, and a minimal `fb.test`/`fb.expect`
 * surface whose assertion failures are caught and recorded (never thrown past the
 * sandbox). Results are read back via {@link extractPostResponseResults}.
 */
export function injectFbPostResponseApi(options: InjectFbPostResponseOptions): void {
  const { ctx, response, envVars } = options;
  const fb = ctx.newObject();
  injectFbEnv(ctx, fb, { ...envVars });
  injectFbUtils(ctx, fb);
  ctx.setProp(ctx.global, 'fb', fb);
  fb.dispose();

  const initScript = `
    globalThis.__fb_env_store = ${JSON.stringify(envVars)};
    globalThis.__fb_response = ${JSON.stringify(response)};
    globalThis.__fb_tests = [];
  `;
  evalOrThrow(ctx, initScript, 'Post-response init error').dispose();

  const apiScript = `(function() {
    // Sync fb.env to __fb_env_store (so mutations are extractable).
    const origSet = fb.env.set;
    fb.env.set = function(key, value) { globalThis.__fb_env_store[key] = value; return origSet(key, value); };
    fb.env.get = function(key) { const v = globalThis.__fb_env_store[key]; return v !== undefined ? v : undefined; };

    // Read-only fb.response.
    const r = globalThis.__fb_response;
    fb.response = {
      get status() { return r.status; },
      get headers() { return r.headers; },
      get body() { return r.body; },
      get time() { return r.time; },
    };

    // Assertion failures are tagged so fb.test can tell them apart from genuine
    // runtime errors (a typo / wrong-type call) that would otherwise masquerade as
    // ordinary assertion failures.
    function __fbAssert(msg) { var e = new Error(msg); e.fbAssertion = true; throw e; }

    // Minimal test surface — failures are recorded, never escape the sandbox.
    fb.test = function(name, fn) {
      try { fn(); globalThis.__fb_tests.push({ name: String(name), passed: true }); }
      catch (e) {
        var msg = (e && e.message) ? String(e.message) : String(e);
        // A non-assertion throw is a bug in the test code, not a failed expectation.
        if (!(e && e.fbAssertion)) msg = 'Runtime error: ' + msg;
        globalThis.__fb_tests.push({ name: String(name), passed: false, error: msg });
      }
    };
    fb.expect = function(actual) {
      return {
        toBe: function(expected) { if (actual !== expected) __fbAssert('Expected ' + JSON.stringify(actual) + ' to be ' + JSON.stringify(expected)); },
        toEqual: function(expected) { if (JSON.stringify(actual) !== JSON.stringify(expected)) __fbAssert('Expected ' + JSON.stringify(actual) + ' to equal ' + JSON.stringify(expected)); },
        toContain: function(sub) {
          if (typeof actual !== 'string' && !Array.isArray(actual)) {
            __fbAssert('toContain expects a string or array, got ' + (actual === null ? 'null' : typeof actual));
          }
          if (actual.indexOf(sub) === -1) __fbAssert('Expected ' + JSON.stringify(actual) + ' to contain ' + JSON.stringify(sub));
        },
        toBeGreaterThan: function(n) { if (!(actual > n)) __fbAssert('Expected ' + actual + ' to be greater than ' + n); },
      };
    };
  })()`;
  evalOrThrow(ctx, apiScript, 'Post-response API init error').dispose();
}

/** Read env mutations + test results back out of a post-response sandbox. */
export function extractPostResponseResults(
  ctx: QuickJSAsyncContext,
  inputEnvVars: Record<string, string>,
  consoleLogs: ConsoleLogEntry[],
): PostResponseResult {
  const read = (code: string): unknown => {
    const res = ctx.evalCode(code);
    if (res.error) { res.error.dispose(); return undefined; }
    const json = ctx.getString(res.value);
    res.value.dispose();
    try { return JSON.parse(json); } catch { return undefined; }
  };

  const allEnv = (read(`JSON.stringify(globalThis.__fb_env_store)`) as Record<string, string>) ?? {};
  const envMutations: Record<string, string> = {};
  for (const [key, value] of Object.entries(allEnv)) {
    if (inputEnvVars[key] !== value) envMutations[key] = value;
  }

  const testResults = (read(`JSON.stringify(globalThis.__fb_tests)`) as TestResult[]) ?? [];

  return { envMutations, consoleLogs, testResults };
}

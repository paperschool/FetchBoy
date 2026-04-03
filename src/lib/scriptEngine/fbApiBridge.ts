import type { QuickJSAsyncContext, QuickJSHandle } from 'quickjs-emscripten';
import { sha256 } from 'js-sha256';
import type { ScriptContext, ConsoleLogEntry, HttpLogEntry, HttpSender } from './types';
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

import { newQuickJSAsyncWASMModule, type QuickJSAsyncContext, type QuickJSHandle } from 'quickjs-emscripten';
import type {
  ScriptContext, ScriptResult, ScriptError, ConsoleLogEntry, HttpLogEntry, HttpSender,
  PostResponseContext, PostResponseResult, TestResult, ResponseSnapshotForScript,
} from './types';
import { SCRIPT_TIMEOUT_MS } from './constants';
import {
  injectFbApi, injectConsole, injectFbPostResponseApi, extractPostResponseResults,
} from './fbApiBridge';
import { extractResults } from './extractResults';

/**
 * Build a complete, useful error from a QuickJS error handle. Error properties are
 * non-enumerable, so `ctx.dump` alone loses `message`/`stack` — read them explicitly,
 * then recover the script line number from the stack trace.
 */
function extractScriptError(ctx: QuickJSAsyncContext, errorHandle: QuickJSHandle, scriptFilename: string): ScriptError {
  const readProp = (prop: string): string => {
    const h = ctx.getProp(errorHandle, prop);
    try {
      const v = ctx.dump(h);
      return typeof v === 'string' ? v : v == null ? '' : String(v);
    } catch {
      return '';
    } finally {
      h.dispose();
    }
  };

  const dumped = ctx.dump(errorHandle);
  const dumpedObj = (typeof dumped === 'object' && dumped !== null ? dumped : {}) as Record<string, unknown>;
  const name = readProp('name') || (dumpedObj.name ? String(dumpedObj.name) : 'Error');
  const rawMessage =
    readProp('message') ||
    (dumpedObj.message ? String(dumpedObj.message) : '') ||
    (typeof dumped === 'string' ? dumped : '');
  const stack = readProp('stack') || (dumpedObj.stack ? String(dumpedObj.stack) : '');

  // QuickJS frames look like:  at <eval> (pre-request-script.js:LINE:COL)
  const escaped = scriptFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineMatch =
    stack.match(new RegExp(`${escaped}:(\\d+)`)) ??
    stack.match(/:(\d+):\d+/) ??
    stack.match(/:(\d+)\)/) ??
    rawMessage.match(/line (\d+)/i);
  const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : undefined;

  const message = rawMessage ? `${name}: ${rawMessage}` : name || 'Script error';
  return { message, lineNumber, stack: stack || undefined };
}

export type {
  ScriptContext, ScriptResult, ScriptError, ConsoleLogEntry, HttpLogEntry, HttpSender,
  PostResponseContext, PostResponseResult, TestResult, ResponseSnapshotForScript,
};

export interface ExecuteOptions {
  /** Callback to perform HTTP requests from inside the sandbox */
  httpSender?: HttpSender;
  /** Override script timeout (ms). Default: 30000 */
  timeoutMs?: number;
}

export async function executePreRequestScript(
  script: string,
  context: ScriptContext,
  options?: ExecuteOptions,
): Promise<ScriptResult> {
  const module = await newQuickJSAsyncWASMModule();
  const runtime = module.newRuntime();
  const timeoutMs = options?.timeoutMs ?? SCRIPT_TIMEOUT_MS;
  const startTime = Date.now();

  runtime.setInterruptHandler(() => Date.now() - startTime > timeoutMs);

  const ctx = runtime.newContext();
  const consoleLogs: ConsoleLogEntry[] = [];
  const httpLogs: HttpLogEntry[] = [];

  try {
    injectConsole(ctx, consoleLogs);
    injectFbApi({ ctx, input: context, httpLogs, httpSender: options?.httpSender });

    const result = await ctx.evalCodeAsync(script, 'pre-request-script.js');
    if (result.error) {
      const err = extractScriptError(ctx, result.error, 'pre-request-script.js');
      result.error.dispose();
      throw { ...err, consoleLogs, httpLogs } as ScriptError & { consoleLogs: ConsoleLogEntry[]; httpLogs: HttpLogEntry[] };
    }
    result.value.dispose();

    return extractResults(ctx, context, consoleLogs, httpLogs);
  } finally {
    ctx.dispose();
    // Async QuickJS module has a known issue with host function HostRef cleanup.
    // The runtime disposal may throw even though all JS execution completed correctly.
    try { runtime.dispose(); } catch { /* host-ref cleanup — safe to ignore */ }
  }
}

/**
 * Run a post-response/test script: read-only `fb.response`, `fb.env`, `fb.utils`,
 * `console`, and `fb.test`/`fb.expect`. Reuses the pre-request QuickJS limits.
 */
export async function executePostResponseScript(
  script: string,
  context: PostResponseContext,
  options?: { timeoutMs?: number },
): Promise<PostResponseResult> {
  const module = await newQuickJSAsyncWASMModule();
  const runtime = module.newRuntime();
  const timeoutMs = options?.timeoutMs ?? SCRIPT_TIMEOUT_MS;
  const startTime = Date.now();

  runtime.setInterruptHandler(() => Date.now() - startTime > timeoutMs);

  const ctx = runtime.newContext();
  const consoleLogs: ConsoleLogEntry[] = [];

  try {
    injectConsole(ctx, consoleLogs);
    injectFbPostResponseApi({ ctx, response: context.response, envVars: context.envVars });

    const result = await ctx.evalCodeAsync(script, 'post-response-script.js');
    if (result.error) {
      const err = extractScriptError(ctx, result.error, 'post-response-script.js');
      result.error.dispose();
      throw { ...err, consoleLogs } as ScriptError & { consoleLogs: ConsoleLogEntry[] };
    }
    result.value.dispose();

    return extractPostResponseResults(ctx, context.envVars, consoleLogs);
  } finally {
    ctx.dispose();
    try { runtime.dispose(); } catch { /* host-ref cleanup — safe to ignore */ }
  }
}

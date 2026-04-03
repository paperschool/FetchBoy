import { newQuickJSAsyncWASMModule } from 'quickjs-emscripten';
import type { ScriptContext, ScriptResult, ScriptError, ConsoleLogEntry, HttpLogEntry, HttpSender } from './types';
import { SCRIPT_TIMEOUT_MS } from './constants';
import { injectFbApi, injectConsole } from './fbApiBridge';
import { extractResults } from './extractResults';

export type { ScriptContext, ScriptResult, ScriptError, ConsoleLogEntry, HttpLogEntry, HttpSender };

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
      const errorVal = ctx.dump(result.error);
      result.error.dispose();
      const message = typeof errorVal === 'object' && errorVal?.message
        ? String(errorVal.message)
        : String(errorVal);
      const lineMatch = message.match(/line (\d+)/i) ?? String(errorVal).match(/:(\d+)\b/);
      const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
      throw { message, lineNumber, consoleLogs, httpLogs } as ScriptError & { consoleLogs: ConsoleLogEntry[]; httpLogs: HttpLogEntry[] };
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

import type { QuickJSAsyncContext } from 'quickjs-emscripten';
import type { KeyValuePair } from '@/lib/db';
import type { ScriptContext, ScriptResult, ConsoleLogEntry, HttpLogEntry } from './types';

export function extractResults(
  ctx: QuickJSAsyncContext,
  input: ScriptContext,
  consoleLogs: ConsoleLogEntry[],
  httpLogs: HttpLogEntry[],
): ScriptResult {
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

  // Extract env mutations
  const envExtractCode = `JSON.stringify(globalThis.__fb_env_store)`;
  const envResult = ctx.evalCode(envExtractCode);
  let envMutations: Record<string, string> = {};
  if (envResult.error) {
    envResult.error.dispose();
  } else {
    const allEnv = JSON.parse(ctx.getString(envResult.value)) as Record<string, string>;
    envResult.value.dispose();
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
    consoleLogs,
    httpLogs,
  };
}

import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  executePreRequestScript,
  type ScriptError,
  type ConsoleLogEntry,
  type HttpLogEntry,
  type HttpSender,
} from '@/lib/scriptEngine';
import { useEnvironmentStore } from '@/stores/environmentStore';

type KeyValueRow = { key: string; value: string; enabled: boolean };

interface PreRequestContext {
  url: string;
  method: string;
  headers: KeyValueRow[];
  queryParams: KeyValueRow[];
  body: string;
}

interface PreRequestResult {
  url: string;
  headers: KeyValueRow[];
  queryParams: KeyValueRow[];
  body: string;
  consoleLogs: ConsoleLogEntry[];
  httpLogs: HttpLogEntry[];
}

interface UsePreRequestScriptReturn {
  executePreScript: (
    script: string,
    context: PreRequestContext,
  ) => Promise<PreRequestResult>;
}

export type { ScriptError, ConsoleLogEntry, HttpLogEntry };

/** Sends an HTTP request via Tauri's send_request command — used by fb.http inside the sandbox */
const tauriHttpSender: HttpSender = async (method, url, options) => {
  const response = await invoke<{
    status: number;
    statusText: string;
    body: string;
    headers: Array<{ name: string; value: string }>;
  }>('send_request', {
    request: {
      method,
      url,
      headers: options?.headers
        ? Object.entries(options.headers).map(([key, value]) => ({ key, value, enabled: true }))
        : [],
      queryParams: [],
      body: { mode: options?.body ? 'raw' : 'none', raw: options?.body ?? '' },
      auth: { type: 'none' },
      timeoutMs: 10_000,
      sslVerify: true,
      requestId: `script-http-${Date.now()}`,
    },
  });
  const headersMap: Record<string, string> = {};
  for (const h of response.headers) headersMap[h.name] = h.value;
  return { status: response.status, headers: headersMap, body: response.body };
};

export function usePreRequestScript(): UsePreRequestScriptReturn {
  const executePreScript = useCallback(
    async (script: string, context: PreRequestContext): Promise<PreRequestResult> => {
      const envStore = useEnvironmentStore.getState();
      const envVars: Record<string, string> = {};
      for (const env of envStore.environments) {
        if (env.is_active) {
          for (const v of env.variables) {
            if (v.enabled) envVars[v.key] = v.value;
          }
        }
      }

      const scriptResult = await executePreRequestScript(script, {
        url: context.url,
        method: context.method,
        headers: context.headers,
        queryParams: context.queryParams,
        body: context.body,
        envVars,
      }, { httpSender: tauriHttpSender });

      // Persist env mutations
      if (Object.keys(scriptResult.envMutations).length > 0) {
        const activeEnv = envStore.environments.find((e) => e.is_active);
        if (activeEnv) {
          let updatedVars = activeEnv.variables.map((v) => ({ ...v }));
          for (const [key, value] of Object.entries(scriptResult.envMutations)) {
            const idx = updatedVars.findIndex((v) => v.key === key);
            if (idx >= 0) {
              updatedVars[idx] = { ...updatedVars[idx], value };
            } else {
              updatedVars.push({ key, value, enabled: true });
            }
          }
          envStore.updateVariables(activeEnv.id, updatedVars);
        }
      }

      return {
        url: scriptResult.url,
        headers: scriptResult.headers,
        queryParams: scriptResult.queryParams,
        body: scriptResult.body,
        consoleLogs: scriptResult.consoleLogs,
        httpLogs: scriptResult.httpLogs,
      };
    },
    [],
  );

  return { executePreScript };
}

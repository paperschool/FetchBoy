import { useCallback } from 'react';
import { executePreRequestScript, type ScriptError } from '@/lib/scriptEngine';
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
}

interface UsePreRequestScriptReturn {
  executePreScript: (
    script: string,
    context: PreRequestContext,
  ) => Promise<PreRequestResult>;
}

export type { ScriptError };

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
      });

      // Persist env mutations
      if (Object.keys(scriptResult.envMutations).length > 0) {
        const activeEnv = envStore.environments.find((e) => e.is_active);
        if (activeEnv) {
          const updatedVars = [...activeEnv.variables];
          for (const [key, value] of Object.entries(scriptResult.envMutations)) {
            const existing = updatedVars.find((v) => v.key === key);
            if (existing) {
              existing.value = value;
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
      };
    },
    [],
  );

  return { executePreScript };
}

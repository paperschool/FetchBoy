import { useCallback } from 'react';
import {
  executePostResponseScript,
  type ScriptError,
  type ConsoleLogEntry,
  type TestResult,
  type ResponseSnapshotForScript,
} from '@/lib/scriptEngine';
import { useEnvironmentStore } from '@/stores/environmentStore';

interface PostResponseResultOut {
  consoleLogs: ConsoleLogEntry[];
  testResults: TestResult[];
}

interface UsePostResponseScriptReturn {
  executePostScript: (
    script: string,
    response: ResponseSnapshotForScript,
  ) => Promise<PostResponseResultOut>;
}

export type { ScriptError };

/**
 * Runs a post-response script after the response returns. Mirrors usePreRequestScript:
 * builds env vars from the active environment, executes the sandbox with a read-only
 * `fb.response`, and persists any `fb.env.set` mutations back to the active environment.
 */
export function usePostResponseScript(): UsePostResponseScriptReturn {
  const executePostScript = useCallback(
    async (script: string, response: ResponseSnapshotForScript): Promise<PostResponseResultOut> => {
      const envStore = useEnvironmentStore.getState();
      const envVars: Record<string, string> = {};
      for (const env of envStore.environments) {
        if (env.is_active) {
          for (const v of env.variables) {
            if (v.enabled) envVars[v.key] = v.value;
          }
        }
      }

      const result = await executePostResponseScript(script, { response, envVars });

      // Persist env mutations to the active environment (same path as pre-request).
      if (Object.keys(result.envMutations).length > 0) {
        const activeEnv = envStore.environments.find((e) => e.is_active);
        if (activeEnv) {
          const updatedVars = activeEnv.variables.map((v) => ({ ...v }));
          for (const [key, value] of Object.entries(result.envMutations)) {
            const idx = updatedVars.findIndex((v) => v.key === key);
            if (idx >= 0) updatedVars[idx] = { ...updatedVars[idx], value };
            else updatedVars.push({ key, value, enabled: true });
          }
          envStore.updateVariables(activeEnv.id, updatedVars);
        }
      }

      return { consoleLogs: result.consoleLogs, testResults: result.testResults };
    },
    [],
  );

  return { executePostScript };
}

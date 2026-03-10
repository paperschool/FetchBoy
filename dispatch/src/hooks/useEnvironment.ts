import { useEnvironmentStore } from '@/stores/environmentStore';
import { interpolate, unresolvedTokens } from '@/lib/interpolate';
import type { KeyValuePair } from '@/lib/db';

export function useEnvironment() {
    const environments = useEnvironmentStore((s) => s.environments);
    const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);

    const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
    const activeVariables: KeyValuePair[] = activeEnv?.variables ?? [];

    return {
        interpolate: (str: string) => interpolate(str, activeVariables),
        unresolvedIn: (str: string) => unresolvedTokens(str, activeVariables),
        activeVariables,
    };
}

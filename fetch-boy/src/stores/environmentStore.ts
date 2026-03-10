import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Environment, KeyValuePair } from '@/lib/db';

interface EnvironmentState {
    environments: Environment[];
    activeEnvironmentId: string | null;

    loadAll: (environments: Environment[]) => void;
    addEnvironment: (env: Environment) => void;
    renameEnvironment: (id: string, name: string) => void;
    deleteEnvironment: (id: string) => void;
    updateVariables: (id: string, variables: KeyValuePair[]) => void;
    setActive: (id: string | null) => void;
}

export const useEnvironmentStore = create<EnvironmentState>()(
    immer((set) => ({
        environments: [],
        activeEnvironmentId: null,

        loadAll: (environments) =>
            set((state) => {
                state.environments = environments;
                const active = environments.find((e) => e.is_active);
                state.activeEnvironmentId = active ? active.id : null;
            }),

        addEnvironment: (env) =>
            set((state) => {
                state.environments.push(env);
            }),

        renameEnvironment: (id, name) =>
            set((state) => {
                const env = state.environments.find((e) => e.id === id);
                if (env) env.name = name;
            }),

        deleteEnvironment: (id) =>
            set((state) => {
                state.environments = state.environments.filter((e) => e.id !== id);
                if (state.activeEnvironmentId === id) {
                    state.activeEnvironmentId = null;
                }
            }),

        updateVariables: (id, variables) =>
            set((state) => {
                const env = state.environments.find((e) => e.id === id);
                if (env) env.variables = variables;
            }),

        setActive: (id) =>
            set((state) => {
                state.activeEnvironmentId = id;
                for (const env of state.environments) {
                    env.is_active = env.id === id;
                }
            }),
    })),
);

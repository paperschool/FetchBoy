import { beforeEach, describe, expect, it } from 'vitest';
import type { Environment } from '@/lib/db';
import { useEnvironmentStore } from '@/stores/environmentStore';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeEnv = (overrides: Partial<Environment> = {}): Environment => ({
    id: crypto.randomUUID(),
    name: 'My Environment',
    variables: [],
    is_active: false,
    created_at: new Date().toISOString(),
    ...overrides,
});

const resetStore = () =>
    useEnvironmentStore.setState({ environments: [], activeEnvironmentId: null });

describe('environmentStore', () => {
    beforeEach(resetStore);

    describe('loadAll', () => {
        it('populates environments and sets activeEnvironmentId from is_active', () => {
            const envs = [
                makeEnv({ id: 'a', is_active: false }),
                makeEnv({ id: 'b', is_active: true }),
            ];
            useEnvironmentStore.getState().loadAll(envs);
            expect(useEnvironmentStore.getState().environments).toEqual(envs);
            expect(useEnvironmentStore.getState().activeEnvironmentId).toBe('b');
        });

        it('sets activeEnvironmentId to null when no env is active', () => {
            const envs = [makeEnv({ id: 'a', is_active: false })];
            useEnvironmentStore.getState().loadAll(envs);
            expect(useEnvironmentStore.getState().activeEnvironmentId).toBeNull();
        });

        it('replaces previously loaded environments', () => {
            useEnvironmentStore.getState().loadAll([makeEnv({ id: 'old', is_active: false })]);
            const fresh = [makeEnv({ id: 'new', is_active: false })];
            useEnvironmentStore.getState().loadAll(fresh);
            expect(useEnvironmentStore.getState().environments).toHaveLength(1);
            expect(useEnvironmentStore.getState().environments[0].id).toBe('new');
        });
    });

    describe('addEnvironment', () => {
        it('appends the new environment to the array', () => {
            const first = makeEnv({ id: 'first' });
            const second = makeEnv({ id: 'second' });
            useEnvironmentStore.getState().addEnvironment(first);
            useEnvironmentStore.getState().addEnvironment(second);
            expect(useEnvironmentStore.getState().environments).toHaveLength(2);
            expect(useEnvironmentStore.getState().environments[1].id).toBe('second');
        });
    });

    describe('renameEnvironment', () => {
        it('mutates name for the correct id only', () => {
            useEnvironmentStore.getState().loadAll([
                makeEnv({ id: 'a', name: 'Alpha' }),
                makeEnv({ id: 'b', name: 'Beta' }),
            ]);
            useEnvironmentStore.getState().renameEnvironment('a', 'Alpha Renamed');
            const envs = useEnvironmentStore.getState().environments;
            expect(envs.find((e) => e.id === 'a')?.name).toBe('Alpha Renamed');
            expect(envs.find((e) => e.id === 'b')?.name).toBe('Beta');
        });
    });

    describe('deleteEnvironment', () => {
        it('removes the environment from the array', () => {
            useEnvironmentStore.getState().loadAll([
                makeEnv({ id: 'a' }),
                makeEnv({ id: 'b' }),
            ]);
            useEnvironmentStore.getState().deleteEnvironment('a');
            expect(useEnvironmentStore.getState().environments).toHaveLength(1);
            expect(useEnvironmentStore.getState().environments[0].id).toBe('b');
        });

        it('sets activeEnvironmentId to null if the deleted env was active', () => {
            useEnvironmentStore.getState().loadAll([makeEnv({ id: 'a', is_active: true })]);
            useEnvironmentStore.getState().deleteEnvironment('a');
            expect(useEnvironmentStore.getState().activeEnvironmentId).toBeNull();
        });

        it('does not change activeEnvironmentId when deleting a non-active env', () => {
            useEnvironmentStore.getState().loadAll([
                makeEnv({ id: 'a', is_active: true }),
                makeEnv({ id: 'b', is_active: false }),
            ]);
            useEnvironmentStore.getState().deleteEnvironment('b');
            expect(useEnvironmentStore.getState().activeEnvironmentId).toBe('a');
        });
    });

    describe('updateVariables', () => {
        it('replaces variables for the correct env only', () => {
            const vars = [{ key: 'TOKEN', value: 'xyz', enabled: true }];
            useEnvironmentStore.getState().loadAll([
                makeEnv({ id: 'a', variables: [] }),
                makeEnv({ id: 'b', variables: [] }),
            ]);
            useEnvironmentStore.getState().updateVariables('a', vars);
            const envs = useEnvironmentStore.getState().environments;
            expect(envs.find((e) => e.id === 'a')?.variables).toEqual(vars);
            expect(envs.find((e) => e.id === 'b')?.variables).toEqual([]);
        });
    });

    describe('setActive', () => {
        it('sets activeEnvironmentId and flips is_active on environments', () => {
            useEnvironmentStore.getState().loadAll([
                makeEnv({ id: 'a', is_active: true }),
                makeEnv({ id: 'b', is_active: false }),
            ]);
            useEnvironmentStore.getState().setActive('b');
            expect(useEnvironmentStore.getState().activeEnvironmentId).toBe('b');
            const envs = useEnvironmentStore.getState().environments;
            expect(envs.find((e) => e.id === 'a')?.is_active).toBe(false);
            expect(envs.find((e) => e.id === 'b')?.is_active).toBe(true);
        });

        it('sets activeEnvironmentId to null and all is_active to false when called with null', () => {
            useEnvironmentStore.getState().loadAll([
                makeEnv({ id: 'a', is_active: true }),
            ]);
            useEnvironmentStore.getState().setActive(null);
            expect(useEnvironmentStore.getState().activeEnvironmentId).toBeNull();
            expect(useEnvironmentStore.getState().environments[0].is_active).toBe(false);
        });
    });
});

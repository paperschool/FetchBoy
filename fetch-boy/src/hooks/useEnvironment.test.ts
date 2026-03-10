import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { KeyValuePair } from '@/lib/db';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const interpolateMock = vi.fn((str: string) => str);
const unresolvedTokensMock = vi.fn((): string[] => []);

vi.mock('@/lib/interpolate', () => ({
    interpolate: (...args: unknown[]) => interpolateMock(...args),
    unresolvedTokens: (...args: unknown[]) => unresolvedTokensMock(...args),
}));

const storeState = {
    environments: [] as { id: string; name: string; variables: KeyValuePair[]; is_active: boolean; created_at: string }[],
    activeEnvironmentId: null as string | null,
};

vi.mock('@/stores/environmentStore', () => ({
    useEnvironmentStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));

// ─── Import hook after mocks are set up ──────────────────────────────────────

const { useEnvironment } = await import('@/hooks/useEnvironment');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useEnvironment', () => {
    beforeEach(() => {
        interpolateMock.mockReset();
        unresolvedTokensMock.mockReset();
        interpolateMock.mockImplementation((str: string) => str);
        unresolvedTokensMock.mockReturnValue([]);
        storeState.environments = [];
        storeState.activeEnvironmentId = null;
    });

    it('calls interpolate with active environment variables', () => {
        const vars: KeyValuePair[] = [
            { key: 'HOST', value: 'api.example.com', enabled: true },
            { key: 'TOKEN', value: 'abc123', enabled: true },
        ];
        storeState.environments = [{ id: 'env-1', name: 'Dev', variables: vars, is_active: true, created_at: '' }];
        storeState.activeEnvironmentId = 'env-1';

        const { result } = renderHook(() => useEnvironment());
        result.current.interpolate('{{HOST}}');

        expect(interpolateMock).toHaveBeenCalledWith('{{HOST}}', vars);
    });

    it('calls interpolate with empty array when no active environment', () => {
        storeState.environments = [];
        storeState.activeEnvironmentId = null;

        const { result } = renderHook(() => useEnvironment());
        result.current.interpolate('{{HOST}}');

        expect(interpolateMock).toHaveBeenCalledWith('{{HOST}}', []);
    });

    it('wires unresolvedIn through to unresolvedTokens with active vars', () => {
        const vars: KeyValuePair[] = [{ key: 'BASE', value: 'https://x.com', enabled: true }];
        storeState.environments = [{ id: 'env-2', name: 'Prod', variables: vars, is_active: false, created_at: '' }];
        storeState.activeEnvironmentId = 'env-2';
        unresolvedTokensMock.mockReturnValue(['PATH']);

        const { result } = renderHook(() => useEnvironment());
        const unresolved = result.current.unresolvedIn('{{BASE}}/{{PATH}}');

        expect(unresolvedTokensMock).toHaveBeenCalledWith('{{BASE}}/{{PATH}}', vars);
        expect(unresolved).toEqual(['PATH']);
    });

    it('exposes activeVariables from the active environment', () => {
        const vars: KeyValuePair[] = [{ key: 'X', value: '1', enabled: true }];
        storeState.environments = [{ id: 'env-3', name: 'Test', variables: vars, is_active: true, created_at: '' }];
        storeState.activeEnvironmentId = 'env-3';

        const { result } = renderHook(() => useEnvironment());
        expect(result.current.activeVariables).toEqual(vars);
    });

    it('returns empty activeVariables when activeEnvironmentId does not match any environment', () => {
        storeState.environments = [{ id: 'env-1', name: 'Dev', variables: [{ key: 'X', value: '1', enabled: true }], is_active: false, created_at: '' }];
        storeState.activeEnvironmentId = 'env-999';

        const { result } = renderHook(() => useEnvironment());
        expect(result.current.activeVariables).toEqual([]);
    });
});

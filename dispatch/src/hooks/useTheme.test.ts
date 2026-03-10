import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTheme } from './useTheme';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { mockStoreState } = vi.hoisted(() => {
    const mockStoreState = { theme: 'light' as 'light' | 'dark' };
    return { mockStoreState };
});

vi.mock('@/stores/uiSettingsStore', () => ({
    useUiSettingsStore: (selector?: (s: typeof mockStoreState) => unknown) =>
        selector ? selector(mockStoreState) : mockStoreState,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMediaQuery(matches: boolean) {
    const listeners: Array<(e: MediaQueryListEvent) => void> = [];
    return {
        matches,
        addEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
            listeners.push(cb);
        }),
        removeEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
            const idx = listeners.indexOf(cb);
            if (idx !== -1) listeners.splice(idx, 1);
        }),
        dispatchChange: (newMatches: boolean) => {
            listeners.forEach((cb) => cb({ matches: newMatches } as MediaQueryListEvent));
        },
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useTheme', () => {
    beforeEach(() => {
        document.documentElement.classList.remove('dark');
        mockStoreState.theme = 'light';
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.documentElement.classList.remove('dark');
    });

    it('removes .dark class when theme is light', () => {
        document.documentElement.classList.add('dark');
        mockStoreState.theme = 'light';

        renderHook(() => useTheme());

        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('adds .dark class when theme is dark', () => {
        mockStoreState.theme = 'dark';

        renderHook(() => useTheme());

        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
});


import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTheme } from './useTheme';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { mockStoreState } = vi.hoisted(() => {
    const mockStoreState = { theme: 'system' as 'light' | 'dark' | 'system' };
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
        mockStoreState.theme = 'system';
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

    it('adds .dark when system theme is dark', () => {
        mockStoreState.theme = 'system';
        const mq = makeMediaQuery(true);
        vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);

        renderHook(() => useTheme());

        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes .dark when system theme is light', () => {
        document.documentElement.classList.add('dark');
        mockStoreState.theme = 'system';
        const mq = makeMediaQuery(false);
        vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);

        renderHook(() => useTheme());

        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('cleans up media query listener on unmount', () => {
        mockStoreState.theme = 'system';
        const mq = makeMediaQuery(false);
        vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);

        const { unmount } = renderHook(() => useTheme());
        unmount();

        expect(mq.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
});

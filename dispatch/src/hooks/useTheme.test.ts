import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTheme } from './useTheme';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { mockStoreState } = vi.hoisted(() => {
    const mockStoreState = { theme: 'light' as 'light' | 'dark' | 'system' };
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

    it('system mode adds .dark when matchMedia matches dark', () => {
        const mq = makeMediaQuery(true);
        vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
        mockStoreState.theme = 'system';

        renderHook(() => useTheme());

        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('system mode removes .dark when matchMedia matches light', () => {
        document.documentElement.classList.add('dark');
        const mq = makeMediaQuery(false);
        vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
        mockStoreState.theme = 'system';

        renderHook(() => useTheme());

        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('system mode attaches media query listener and reacts to changes', () => {
        const mq = makeMediaQuery(false);
        vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
        mockStoreState.theme = 'system';

        renderHook(() => useTheme());

        expect(mq.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
        mq.dispatchChange(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        mq.dispatchChange(false);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('system mode cleans up media query listener on unmount', () => {
        const mq = makeMediaQuery(false);
        vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
        mockStoreState.theme = 'system';

        const { unmount } = renderHook(() => useTheme());
        unmount();

        expect(mq.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
});


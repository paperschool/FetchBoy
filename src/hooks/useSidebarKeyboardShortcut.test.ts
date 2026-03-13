import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { saveSetting } from '@/lib/settings';
import useSidebarKeyboardShortcut from './useSidebarKeyboardShortcut';

vi.mock('@/lib/settings', () => ({
    saveSetting: vi.fn().mockResolvedValue(undefined),
}));

describe('useSidebarKeyboardShortcut', () => {
    beforeEach(() => {
        useUiSettingsStore.setState({ sidebarCollapsed: false });
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('toggles sidebar when Cmd+B is pressed on Mac', () => {
        renderHook(() => useSidebarKeyboardShortcut());

        const event = new KeyboardEvent('keydown', {
            key: 'b',
            metaKey: true,
            bubbles: true,
        });
        window.dispatchEvent(event);

        expect(useUiSettingsStore.getState().sidebarCollapsed).toBe(true);
    });

    it('toggles sidebar when Ctrl+B is pressed on Windows/Linux', () => {
        renderHook(() => useSidebarKeyboardShortcut());

        const event = new KeyboardEvent('keydown', {
            key: 'b',
            ctrlKey: true,
            bubbles: true,
        });
        window.dispatchEvent(event);

        expect(useUiSettingsStore.getState().sidebarCollapsed).toBe(true);
    });

    it('toggles sidebar back to expanded when pressed again', () => {
        renderHook(() => useSidebarKeyboardShortcut());

        // First press - collapse
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true }),
        );
        expect(useUiSettingsStore.getState().sidebarCollapsed).toBe(true);

        // Second press - expand
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true }),
        );
        expect(useUiSettingsStore.getState().sidebarCollapsed).toBe(false);
    });

    it('persists sidebar state to database', async () => {
        renderHook(() => useSidebarKeyboardShortcut());

        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true }),
        );

        // Wait for async saveSetting to be called
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(saveSetting).toHaveBeenCalledWith('sidebar_collapsed', true);
    });

    it('does not toggle when B is pressed without modifier key', () => {
        renderHook(() => useSidebarKeyboardShortcut());

        const event = new KeyboardEvent('keydown', {
            key: 'b',
            bubbles: true,
        });
        window.dispatchEvent(event);

        expect(useUiSettingsStore.getState().sidebarCollapsed).toBe(false);
    });

    it('handles uppercase B key', () => {
        renderHook(() => useSidebarKeyboardShortcut());

        const event = new KeyboardEvent('keydown', {
            key: 'B',
            metaKey: true,
            bubbles: true,
        });
        window.dispatchEvent(event);

        expect(useUiSettingsStore.getState().sidebarCollapsed).toBe(true);
    });
});

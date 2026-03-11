import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTabStore, createDefaultRequestSnapshot, createDefaultResponseSnapshot } from '@/stores/tabStore';
import useSendRequestKeyboardShortcut from './useSendRequestKeyboardShortcut';

function makeTab(overrides: Partial<ReturnType<typeof createDefaultResponseSnapshot>> = {}) {
    return {
        id: 'tab-1',
        label: 'Tab 1',
        isCustomLabel: false,
        requestState: createDefaultRequestSnapshot(),
        responseState: { ...createDefaultResponseSnapshot(), ...overrides },
    };
}

describe('useSendRequestKeyboardShortcut', () => {
    beforeEach(() => {
        const tab = makeTab();
        useTabStore.setState({ tabs: [tab], activeTabId: tab.id });
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Clean up any DOM elements added during tests
        document.querySelectorAll('[role="dialog"], [data-headlessui-state]').forEach((el) => el.remove());
        vi.clearAllMocks();
    });

    it('calls onSend when Cmd+Enter is pressed (Mac)', () => {
        const sendFn = vi.fn();
        renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));

        expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('calls onSend when Ctrl+Enter is pressed (Windows/Linux)', () => {
        const sendFn = vi.fn();
        renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));

        expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onSend for plain Enter (no modifier)', () => {
        const sendFn = vi.fn();
        renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(sendFn).not.toHaveBeenCalled();
    });

    it('does NOT call onSend for Cmd+T (different key)', () => {
        const sendFn = vi.fn();
        renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', metaKey: true, bubbles: true }));

        expect(sendFn).not.toHaveBeenCalled();
    });

    it('does NOT call onSend when isSending is true', () => {
        const sendFn = vi.fn();
        const tab = makeTab({ isSending: true });
        useTabStore.setState({ tabs: [tab], activeTabId: tab.id });

        renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));

        expect(sendFn).not.toHaveBeenCalled();
    });

    it('does NOT call onSend when a modal dialog is open', () => {
        const sendFn = vi.fn();
        renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        document.body.appendChild(dialog);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));

        expect(sendFn).not.toHaveBeenCalled();

        dialog.remove();
    });

    it('does NOT call onSend when a Headless UI dropdown is open', () => {
        const sendFn = vi.fn();
        renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        const dropdown = document.createElement('div');
        dropdown.setAttribute('data-headlessui-state', 'open');
        document.body.appendChild(dropdown);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));

        expect(sendFn).not.toHaveBeenCalled();

        dropdown.remove();
    });

    it('calls onSend after modal is removed from DOM', () => {
        const sendFn = vi.fn();
        renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        document.body.appendChild(dialog);

        // Modal present — should NOT send
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
        expect(sendFn).toHaveBeenCalledTimes(0);

        // Modal removed — should send
        dialog.remove();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
        expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('calls onSend even when focus is inside a Monaco editor element', () => {
        const sendFn = vi.fn();
        renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        // Simulate focus inside Monaco editor (the event still bubbles to window)
        const monacoEl = document.createElement('div');
        monacoEl.className = 'monaco-editor';
        document.body.appendChild(monacoEl);
        monacoEl.focus();

        // Cmd+Enter from Monaco should still trigger send
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));

        expect(sendFn).toHaveBeenCalledTimes(1);

        monacoEl.remove();
    });

    it('does NOT call onSend for plain Enter inside Monaco editor', () => {
        const sendFn = vi.fn();
        renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        // Plain Enter dispatched from window (no modifier) — should never send
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(sendFn).not.toHaveBeenCalled();
    });

    it('removes event listener on unmount', () => {
        const sendFn = vi.fn();
        const { unmount } = renderHook(() => useSendRequestKeyboardShortcut(sendFn));

        unmount();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));

        expect(sendFn).not.toHaveBeenCalled();
    });

    it('always calls the latest onSend reference without re-registering listener', () => {
        const firstSendFn = vi.fn();
        const secondSendFn = vi.fn();

        const { rerender } = renderHook(
            ({ onSend }: { onSend: () => void }) => useSendRequestKeyboardShortcut(onSend),
            { initialProps: { onSend: firstSendFn } },
        );

        rerender({ onSend: secondSendFn });

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));

        expect(firstSendFn).not.toHaveBeenCalled();
        expect(secondSendFn).toHaveBeenCalledTimes(1);
    });
});

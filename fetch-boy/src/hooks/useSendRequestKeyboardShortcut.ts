import { useEffect, useRef } from 'react';
import { useTabStore } from '@/stores/tabStore';

/**
 * Registers a global Cmd/Ctrl+Enter keyboard shortcut that triggers onSend.
 *
 * Guards:
 * - No-op when the active tab's request is already in-flight (isSending)
 * - No-op when a modal (role="dialog") or Headless UI dropdown is open
 * - Works from all focus contexts including inside the Monaco editor
 *   (regular Enter in Monaco inserts a newline as normal — we only intercept Cmd/Ctrl+Enter)
 */
export default function useSendRequestKeyboardShortcut(onSend: () => void) {
    const latestOnSend = useRef(onSend);
    latestOnSend.current = onSend;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod || e.key !== 'Enter') return;

            // Check if request is already in-flight
            const store = useTabStore.getState();
            const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
            if (activeTab?.responseState.isSending) return;

            // Block when a modal dialog is open
            const modalOpen = document.querySelector('[role="dialog"]');
            if (modalOpen) return;

            // Block when a Headless UI dropdown/popover is open
            const headlessOpen = document.querySelector('[data-headlessui-state*="open"]');
            if (headlessOpen) return;

            e.preventDefault();
            latestOnSend.current();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
}

import { useEffect } from 'react';
import { useTabStore } from '@/stores/tabStore';

export default function useTabKeyboardShortcuts() {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
            if (target?.closest?.('.monaco-editor')) return;

            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;

            const key = e.key.toLowerCase();
            const store = useTabStore.getState();

            if (key === 't') {
                e.preventDefault();
                store.addTab();
                return;
            }

            if (key === 'w') {
                e.preventDefault();
                if (store.tabs.length === 1) {
                    window.dispatchEvent(
                        new CustomEvent('tab-close-blocked', {
                            detail: { tabId: store.activeTabId },
                        }),
                    );
                    return;
                }
                store.closeTab(store.activeTabId);
                return;
            }

            if (e.key === 'Tab') {
                e.preventDefault();
                store.navigateTab(e.shiftKey ? 'prev' : 'next');
                return;
            }

            if (/^[1-9]$/.test(e.key)) {
                e.preventDefault();
                const tabs = store.tabs;
                if (tabs.length === 0) return;
                const idx = Math.min(parseInt(e.key, 10) - 1, tabs.length - 1);
                store.setActiveTab(tabs[idx].id);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
}

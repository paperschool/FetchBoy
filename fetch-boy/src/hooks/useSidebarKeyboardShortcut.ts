import { useEffect } from 'react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { saveSetting } from '@/lib/settings';

export default function useSidebarKeyboardShortcut() {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;

            const key = e.key.toLowerCase();
            if (key !== 'b') return;

            e.preventDefault();

            const store = useUiSettingsStore.getState();
            const newState = !store.sidebarCollapsed;
            
            store.setSidebarCollapsed(newState);
            
            // Persist to database immediately
            saveSetting('sidebar_collapsed', newState).catch(() => {
                // Silently ignore persistence errors
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
}

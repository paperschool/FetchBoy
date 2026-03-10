import { useEffect } from 'react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

export function useTheme() {
    const theme = useUiSettingsStore((s) => s.theme);

    useEffect(() => {
        if (theme === 'light') {
            document.documentElement.classList.remove('dark');
            return;
        }
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            return;
        }
        // system mode
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        document.documentElement.classList.toggle('dark', mq.matches);
        const handler = (e: MediaQueryListEvent) => {
            document.documentElement.classList.toggle('dark', e.matches);
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);
}

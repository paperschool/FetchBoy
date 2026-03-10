import { useEffect } from 'react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

export function useTheme() {
    const theme = useUiSettingsStore((s) => s.theme);

    useEffect(() => {
        const html = document.documentElement;

        if (theme === 'light') {
            html.classList.remove('dark');
            return;
        }

        if (theme === 'dark') {
            html.classList.add('dark');
            return;
        }

        // System mode
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = (e: MediaQueryListEvent | MediaQueryList) => {
            html.classList.toggle('dark', e.matches);
        };
        apply(mq);
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, [theme]);
}

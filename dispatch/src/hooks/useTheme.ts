import { useEffect } from 'react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

export function useTheme() {
    const theme = useUiSettingsStore((s) => s.theme);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);
}

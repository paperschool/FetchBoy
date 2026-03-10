import { create } from 'zustand';

interface UiSettingsState {
    editorFontSize: number;
    setEditorFontSize: (fontSize: number) => void;
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUiSettingsStore = create<UiSettingsState>((set) => ({
    editorFontSize: 13,
    setEditorFontSize: (fontSize) => set({ editorFontSize: fontSize }),
    theme: 'system',
    setTheme: (theme) => set({ theme }),
}));

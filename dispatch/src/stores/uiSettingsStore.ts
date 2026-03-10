import { create } from 'zustand';

interface UiSettingsState {
    editorFontSize: number;
    setEditorFontSize: (fontSize: number) => void;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
}

export const useUiSettingsStore = create<UiSettingsState>((set) => ({
    editorFontSize: 13,
    setEditorFontSize: (fontSize) => set({ editorFontSize: fontSize }),
    theme: 'light',
    setTheme: (theme) => set({ theme }),
}));

import { create } from 'zustand';

interface UiSettingsState {
  editorFontSize: number;
  setEditorFontSize: (fontSize: number) => void;
}

export const useUiSettingsStore = create<UiSettingsState>((set) => ({
  editorFontSize: 13,
  setEditorFontSize: (fontSize) => set({ editorFontSize: fontSize }),
}));

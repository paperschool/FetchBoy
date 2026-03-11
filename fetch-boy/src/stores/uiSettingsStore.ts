import { create } from 'zustand';

interface UiSettingsState {
    editorFontSize: number;
    setEditorFontSize: (fontSize: number) => void;
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    requestTimeoutMs: number;
    setRequestTimeoutMs: (ms: number) => void;
    sslVerify: boolean;
    setSslVerify: (v: boolean) => void;
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
    sidebarSettingsExpanded: boolean;
    setSidebarSettingsExpanded: (expanded: boolean) => void;
}

export const useUiSettingsStore = create<UiSettingsState>((set) => ({
    editorFontSize: 13,
    setEditorFontSize: (fontSize) => set({ editorFontSize: fontSize }),
    theme: 'system',
    setTheme: (theme) => set({ theme }),
    requestTimeoutMs: 30000,
    setRequestTimeoutMs: (ms) => set({ requestTimeoutMs: ms }),
    sslVerify: true,
    setSslVerify: (v) => set({ sslVerify: v }),
    sidebarCollapsed: false,
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    sidebarSettingsExpanded: false,
    setSidebarSettingsExpanded: (expanded) => set({ sidebarSettingsExpanded: expanded }),
}));

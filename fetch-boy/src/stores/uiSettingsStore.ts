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
    hasSeededSampleData: boolean;
    setHasSeededSampleData: (seeded: boolean) => void;
    lastSeenVersion: string | null;
    setLastSeenVersion: (version: string | null) => void;
    proxyEnabled: boolean;
    setProxyEnabled: (enabled: boolean) => void;
    proxyPort: number;
    setProxyPort: (port: number) => void;
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
    hasSeededSampleData: false,
    setHasSeededSampleData: (seeded) => set({ hasSeededSampleData: seeded }),
    lastSeenVersion: null,
    setLastSeenVersion: (version) => set({ lastSeenVersion: version }),
    proxyEnabled: true,
    setProxyEnabled: (enabled) => set({ proxyEnabled: enabled }),
    proxyPort: 8080,
    setProxyPort: (port) => set({ proxyPort: port }),
}));

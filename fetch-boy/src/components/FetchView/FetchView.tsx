import { useEffect, useCallback } from 'react';
import { TopBar } from '@/components/TopBar/TopBar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MainPanel } from '@/components/MainPanel/MainPanel';
import { TabBar } from '@/components/TabBar/TabBar';
import { TabLayout } from '@/components/Layout/TabLayout';
import { loadAllEnvironments } from '@/lib/environments';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { loadAllSettings, saveSetting } from '@/lib/settings';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useTheme } from '@/hooks/useTheme';
import useTabKeyboardShortcuts from '@/hooks/useTabKeyboardShortcuts';
import useSidebarKeyboardShortcut from '@/hooks/useSidebarKeyboardShortcut';

export function FetchView() {
  useTheme();
  useTabKeyboardShortcuts();
  useSidebarKeyboardShortcut();

  const sidebarCollapsed = useUiSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiSettingsStore((s) => s.setSidebarCollapsed);

  const handleToggleSidebar = useCallback(() => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    saveSetting('sidebar_collapsed', newState).catch(() => {});
  }, [sidebarCollapsed, setSidebarCollapsed]);

  useEffect(() => {
    loadAllEnvironments()
      .then((envs) => useEnvironmentStore.getState().loadAll(envs))
      .catch(() => {}); // swallow gracefully — not available in test env
    loadAllSettings()
      .then((s) => {
        useUiSettingsStore.getState().setTheme(s.theme);
        useUiSettingsStore.getState().setEditorFontSize(s.editor_font_size);
        useUiSettingsStore.getState().setRequestTimeoutMs(s.request_timeout_ms);
        useUiSettingsStore.getState().setSslVerify(s.ssl_verify);
        useUiSettingsStore.getState().setSidebarCollapsed(s.sidebar_collapsed ?? false);
        useUiSettingsStore.getState().setSidebarSettingsExpanded(s.sidebar_settings_expanded ?? false);
        useUiSettingsStore.getState().setHasSeededSampleData(s.has_seeded_sample_data ?? false);
        useUiSettingsStore.getState().setLastSeenVersion(s.last_seen_version ?? null);
        useUiSettingsStore.getState().setProxyEnabled(s.proxy_enabled ?? true);
        useUiSettingsStore.getState().setProxyPort(s.proxy_port ?? 8080);
      })
      .catch(() => {}); // defaults already set in store initial state
  }, []);

  return (
    <TabLayout
      topBar={<TopBar />}
      sidebar={<Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />}
      middleContent={<TabBar />}
      mainContent={<MainPanel />}
      sidebarCollapsed={sidebarCollapsed}
    />
  );
}

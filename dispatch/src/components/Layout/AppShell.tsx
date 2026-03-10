import { useEffect } from 'react';
import { TopBar } from '@/components/TopBar/TopBar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MainPanel } from '@/components/MainPanel/MainPanel';
import { loadAllEnvironments } from '@/lib/environments';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { loadAllSettings } from '@/lib/settings';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useTheme } from '@/hooks/useTheme';

export function AppShell() {
  useTheme();

  useEffect(() => {
    loadAllEnvironments()
      .then((envs) => useEnvironmentStore.getState().loadAll(envs))
      .catch(() => {}); // swallow gracefully — not available in test env
    loadAllSettings()
      .then((s) => {
        useUiSettingsStore.getState().setTheme(s.theme);
        useUiSettingsStore.getState().setEditorFontSize(s.editor_font_size);
      })
      .catch(() => {}); // defaults already set in store initial state
  }, []);

  return (
    <div className="grid h-screen grid-cols-[16rem_1fr] grid-rows-[3rem_1fr] overflow-hidden">
      <TopBar />
      <Sidebar />
      <MainPanel />
    </div>
  );
}

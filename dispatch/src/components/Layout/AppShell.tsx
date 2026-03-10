import { useEffect, useState, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { TopBar } from '@/components/TopBar/TopBar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MainPanel } from '@/components/MainPanel/MainPanel';
import { TabBar } from '@/components/TabBar/TabBar';
import { loadAllEnvironments } from '@/lib/environments';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { loadAllSettings } from '@/lib/settings';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useTheme } from '@/hooks/useTheme';

export function AppShell() {
  useTheme();

  const setSettingsPanelOpen = useUiSettingsStore((s) => s.setSettingsPanelOpen);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const dismissContextMenu = useCallback(() => setContextMenu(null), []);

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
      })
      .catch(() => {}); // defaults already set in store initial state
  }, []);

  return (
    <div
      className="grid h-screen grid-cols-[16rem_1fr] grid-rows-[3rem_2.25rem_1fr] overflow-hidden [&>aside]:row-span-2 [&>main]:col-start-2 [&>main]:row-start-3"
      onContextMenu={handleContextMenu}
      onClick={dismissContextMenu}
    >
      <TopBar />
      <Sidebar />
      <div className="col-start-2 row-start-2 border-b border-app-subtle bg-app-sidebar overflow-hidden">
        <TabBar />
      </div>
      <MainPanel />

      {contextMenu && (
        <ul
          role="menu"
          className="fixed z-50 min-w-[10rem] rounded-md border border-app-subtle bg-app-main py-1 shadow-lg text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <li
            role="menuitem"
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-app-primary hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => {
              setSettingsPanelOpen(true);
              dismissContextMenu();
            }}
          >
            <Settings size={14} className="text-app-muted" />
            Settings
          </li>
        </ul>
      )}
    </div>
  );
}

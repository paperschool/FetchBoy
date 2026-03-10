import { useState } from 'react';
import { Globe, Settings } from 'lucide-react';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { setActiveEnvironment } from '@/lib/environments';
import { EnvironmentPanel } from '@/components/EnvironmentPanel/EnvironmentPanel';
import { SettingsPanel } from '@/components/Settings/SettingsPanel';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

export function TopBar() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const [panelOpen, setPanelOpen] = useState(false);
  const settingsPanelOpen = useUiSettingsStore((s) => s.settingsPanelOpen);
  const setSettingsPanelOpen = useUiSettingsStore((s) => s.setSettingsPanelOpen);

  async function handleEnvChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value || null;
    await setActiveEnvironment(newId);
    useEnvironmentStore.getState().setActive(newId);
  }

  return (
    <header
      data-testid="top-bar"
      className="bg-app-topbar text-app-inverse col-span-2 flex h-12 items-center justify-between px-4"
    >
      <span className="text-lg font-semibold tracking-wide">Fetch Boy 🦴</span>
      <div className="flex items-center gap-2">
        <select
          value={activeEnvironmentId ?? ''}
          onChange={(e) => void handleEnvChange(e)}
          className="select-flat-inverse text-xs text-app-inverse bg-transparent border border-white/20 rounded pl-2 pr-6 py-1"
        >
          <option value="">No Environment</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
        <button
          aria-label="Manage environments"
          title="Manage environments"
          className="text-app-inverse border border-white/20 rounded p-1.5 hover:bg-white/10 flex items-center justify-center"
          onClick={() => setPanelOpen(true)}
        >
          <Globe size={18} />
        </button>
        <button
          aria-label="Open settings"
          title="Open settings"
          className="text-app-inverse border border-white/20 rounded p-1.5 hover:bg-white/10 flex items-center justify-center"
          onClick={() => setSettingsPanelOpen(true)}
        >
          <Settings size={18} />
        </button>
      </div>
      {panelOpen && (
        <EnvironmentPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      )}
      {settingsPanelOpen && (
        <SettingsPanel open={settingsPanelOpen} onClose={() => setSettingsPanelOpen(false)} />
      )}
    </header>
  );
}

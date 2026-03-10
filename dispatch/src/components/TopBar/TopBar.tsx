import { useState } from 'react';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { setActiveEnvironment } from '@/lib/environments';
import { saveSetting } from '@/lib/settings';
import { EnvironmentPanel } from '@/components/EnvironmentPanel/EnvironmentPanel';

export function TopBar() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const theme = useUiSettingsStore((s) => s.theme);
  const [panelOpen, setPanelOpen] = useState(false);

  async function handleEnvChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value || null;
    await setActiveEnvironment(newId);
    useEnvironmentStore.getState().setActive(newId);
  }

  async function handleThemeChange() {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    useUiSettingsStore.getState().setTheme(next);
    await saveSetting('theme', next);
  }

  return (
    <header
      data-testid="top-bar"
      className="bg-app-topbar text-app-inverse col-span-2 flex h-12 items-center justify-between px-4"
    >
      <span className="text-lg font-semibold tracking-wide">Fetch Boy 🦴</span>
      <div className="flex items-center gap-2">
        <button
          aria-label="Toggle theme"
          className="text-xs text-app-inverse border border-white/20 rounded px-2 py-1 hover:bg-white/10"
          onClick={() => void handleThemeChange()}
        >
          {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️'}
        </button>
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
          className="text-xs text-app-inverse border border-white/20 rounded px-2 py-1 hover:bg-white/10"
          onClick={() => setPanelOpen(true)}
        >
          ⚙
        </button>
      </div>
      {panelOpen && (
        <EnvironmentPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      )}
    </header>
  );
}

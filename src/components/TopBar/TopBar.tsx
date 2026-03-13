import { useState } from "react";
import { Globe } from "lucide-react";
import { useEnvironmentStore } from "@/stores/environmentStore";
import { setActiveEnvironment } from "@/lib/environments";
import { EnvironmentPanel } from "@/components/EnvironmentPanel/EnvironmentPanel";
import { AppTopBar } from "@/components/Layout/AppTopBar";

export function TopBar() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const [panelOpen, setPanelOpen] = useState(false);

  async function handleEnvChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value || null;
    await setActiveEnvironment(newId);
    useEnvironmentStore.getState().setActive(newId);
  }

  const actions = (
    <div className="flex items-center gap-2" data-tour="configure-environments">
      <select
        value={activeEnvironmentId ?? ""}
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
    </div>
  );

  return (
    <>
      <AppTopBar title="Fetch Boy 🦴" actions={actions} />
      {panelOpen && (
        <EnvironmentPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      )}
    </>
  );
}

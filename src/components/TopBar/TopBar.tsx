import { useState } from "react";
import { Globe } from "lucide-react";
import { useEnvironmentStore } from "@/stores/environmentStore";
import { setActiveEnvironment } from "@/lib/environments";
import { EnvironmentPanel } from "@/components/EnvironmentPanel/EnvironmentPanel";

export function FetchTabActions() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const [panelOpen, setPanelOpen] = useState(false);

  async function handleEnvChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value || null;
    await setActiveEnvironment(newId);
    useEnvironmentStore.getState().setActive(newId);
  }

  return (
    <>
      <div className="flex items-center gap-2" data-tour="configure-environments">
        <select
          value={activeEnvironmentId ?? ""}
          onChange={(e) => void handleEnvChange(e)}
          className="select-flat border-app-subtle bg-app-main text-app-primary h-7 rounded-md border pl-2 pr-6 text-xs"
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
          className="text-app-muted border border-app-subtle rounded p-1 hover:bg-app-subtle hover:text-app-primary flex items-center justify-center transition-colors"
          onClick={() => setPanelOpen(true)}
        >
          <Globe size={15} />
        </button>
      </div>
      {panelOpen && (
        <EnvironmentPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      )}
    </>
  );
}

/** @deprecated Use FetchTabActions instead */
export function TopBar() {
  return <FetchTabActions />;
}

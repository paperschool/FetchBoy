import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { t } from '@/lib/i18n';
import { useEnvironmentStore } from "@/stores/environmentStore";
import { useCollectionStore } from "@/stores/collectionStore";
import { setActiveEnvironment } from "@/lib/environments";
import { groupEnvironmentsByCollection } from "@/lib/groupEnvironments";
import { EnvironmentPanel } from "@/components/EnvironmentPanel/EnvironmentPanel";

export function FetchTabActions() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const envPanelRequested = useEnvironmentStore((s) => s.envPanelRequested);
  const collections = useCollectionStore((s) => s.collections);
  const [panelOpen, setPanelOpen] = useState(false);

  // Group environments under their owning collection (label = live collection
  // name, so a rename updates the group automatically) with a Shared group last.
  const envGroups = groupEnvironmentsByCollection(environments, collections);

  useEffect(() => {
    if (envPanelRequested) setPanelOpen(true);
  }, [envPanelRequested]);

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
          <option value="">{t('common.noEnvironment')}</option>
          {envGroups.map((group) => (
            <optgroup key={group.collectionId ?? '__shared__'} label={group.label}>
              {group.environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </optgroup>
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
        <EnvironmentPanel open={panelOpen} onClose={() => { setPanelOpen(false); useEnvironmentStore.getState().clearPendingVariable(); }} />
      )}
    </>
  );
}

/** @deprecated Use FetchTabActions instead */
export function TopBar() {
  return <FetchTabActions />;
}

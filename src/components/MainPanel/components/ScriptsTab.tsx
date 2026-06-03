import { useCallback, type ReactNode } from 'react';
import { Code, Layers, FlaskConical, Pencil, ExternalLink } from 'lucide-react';
import { useAppTabStore } from '@/stores/appTabStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { useScriptWorkspaceStore, type ScriptSlot } from '@/stores/scriptWorkspaceStore';
import { updateCollectionScript } from '@/lib/collections';
import { t } from '@/lib/i18n';
import type { ScriptDebugState } from '@/stores/tabStore';

/** One script slot's compact launcher — editing happens in the Script Workspace. */
function SlotLauncher({ icon, label, badge, badgeClass, buttonClass, name, hasScript, statusHas, statusEmpty, enabled, onEnabledChange, onOpen, headerExtra }: {
  icon: ReactNode;
  label: string;
  badge: string;
  badgeClass: string;
  buttonClass: string;
  /** Name of the entity this script belongs to (collection / request). */
  name?: string | null;
  hasScript: boolean;
  statusHas: string;
  statusEmpty: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onOpen: () => void;
  headerExtra?: ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-app-secondary text-sm font-medium">{label}</span>
          <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>{badge}</span>
        </div>
        <div className="flex items-center gap-4">
          {headerExtra}
          <label className="text-app-secondary inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} aria-label={`Enable ${label}`} />
            Enabled
          </label>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded border border-app-subtle bg-app-sidebar/50 px-3 py-2">
        <div className="min-w-0 flex-1">
          {name && <div className="truncate text-xs font-medium text-app-secondary">{name}</div>}
          <div className="text-[11px] text-app-muted">{hasScript ? statusHas : statusEmpty}</div>
        </div>
        <button type="button" onClick={onOpen}
          className={`flex shrink-0 cursor-pointer items-center gap-1 rounded px-3 py-1 text-xs font-medium text-white ${buttonClass}`}>
          {hasScript
            ? <><Pencil size={12} />{t('scripts.edit')}</>
            : <><ExternalLink size={12} />{t('scripts.open')}</>}
        </button>
      </div>
    </div>
  );
}

interface ScriptsTabProps {
  script: string;
  enabled: boolean;
  postResponseScript: string;
  postResponseScriptEnabled: boolean;
  keepOpen: boolean;
  onScriptChange: (script: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onPostResponseEnabledChange: (enabled: boolean) => void;
  onKeepOpenChange: (keepOpen: boolean) => void;
  editorFontSize: number;
  scriptDebugState?: ScriptDebugState;
  onDebugClose?: () => void;
  // Chain/template props are retained for data + execution compatibility; the
  // top-level JS/Chain chooser was removed (Story rework) so they are no longer
  // surfaced here.
  preRequestMode: 'none' | 'javascript' | 'chain';
  onModeChange: (mode: 'none' | 'javascript' | 'chain') => void;
  preRequestChainId: string | null;
  onChainIdChange: (chainId: string | null) => void;
  preRequestTemplateId?: string | null;
  onTemplateIdChange?: (id: string | null) => void;
}

export function ScriptsTab({
  script, enabled, postResponseScript, postResponseScriptEnabled, keepOpen,
  onEnabledChange, onPostResponseEnabledChange, onKeepOpenChange,
}: ScriptsTabProps): React.ReactElement {
  // Resolve the active request (+ its collection) so we can name each slot and
  // surface the collection-wide ("global") script. Unsaved requests omit global.
  const request = useCollectionStore((s) => (s.activeRequestId ? s.requests.find((r) => r.id === s.activeRequestId) ?? null : null));
  const collection = useCollectionStore((s) =>
    request?.collection_id ? s.collections.find((c) => c.id === request.collection_id) ?? null : null,
  );
  const requestName = request?.name ?? null;

  const handleOpenInEditor = useCallback((mode: ScriptSlot) => {
    useScriptWorkspaceStore.getState().setPendingMode(mode);
    useAppTabStore.getState().setActiveTab('scripts');
  }, []);

  const handleGlobalEnabledChange = useCallback((en: boolean) => {
    if (!collection) return;
    const code = collection.pre_request_script ?? '';
    useCollectionStore.getState().setCollectionScript(collection.id, code, en);
    void updateCollectionScript(collection.id, code, en);
  }, [collection]);

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-3">
      {collection ? (
        <SlotLauncher
          icon={<Layers size={14} className="text-sky-400" />}
          label={t('scripts.globalScriptTitle')}
          badge="GLOBAL"
          badgeClass="bg-sky-500/15 text-sky-400"
          buttonClass="bg-sky-600 hover:bg-sky-500"
          name={collection.name}
          hasScript={!!collection.pre_request_script?.trim()}
          statusHas={t('scripts.launcher.hasGlobalScript')}
          statusEmpty={t('scripts.launcher.emptyGlobalScript')}
          enabled={collection.pre_request_script_enabled ?? true}
          onEnabledChange={handleGlobalEnabledChange}
          onOpen={() => handleOpenInEditor('global')}
        />
      ) : (
        <div className="flex items-start gap-2 rounded border border-dashed border-app-subtle bg-app-sidebar/30 px-3 py-2" data-testid="scripts-global-save-hint">
          <Layers size={14} className="mt-0.5 shrink-0 text-app-muted" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-app-secondary">
              {t('scripts.globalScriptTitle')}
              <span className="rounded bg-app-subtle px-2 py-0.5 text-[10px] font-medium text-app-muted">GLOBAL</span>
            </p>
            <p className="text-[11px] text-app-muted">{t('scripts.globalSaveHint')}</p>
          </div>
        </div>
      )}

      <SlotLauncher
        icon={<Code size={14} className="text-amber-400" />}
        label={t('scripts.preRequestScriptTitle')}
        badge="JS"
        badgeClass="bg-amber-500/15 text-amber-400"
        buttonClass="bg-amber-600 hover:bg-amber-500"
        name={requestName}
        hasScript={!!script.trim()}
        statusHas={t('scripts.launcher.hasScript')}
        statusEmpty={t('scripts.launcher.empty')}
        enabled={enabled}
        onEnabledChange={onEnabledChange}
        onOpen={() => handleOpenInEditor('pre')}
        headerExtra={
          <label className="text-app-secondary inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={keepOpen} onChange={(e) => onKeepOpenChange(e.target.checked)} aria-label="Keep script tab open after send" />
            Keep Open
          </label>
        }
      />

      <SlotLauncher
        icon={<FlaskConical size={14} className="text-emerald-400" />}
        label={t('scripts.postResponseScriptTitle')}
        badge="TEST"
        badgeClass="bg-emerald-500/15 text-emerald-400"
        buttonClass="bg-emerald-600 hover:bg-emerald-500"
        name={requestName}
        hasScript={!!postResponseScript.trim()}
        statusHas={t('scripts.launcher.hasPostScript')}
        statusEmpty={t('scripts.launcher.emptyPostScript')}
        enabled={postResponseScriptEnabled}
        onEnabledChange={onPostResponseEnabledChange}
        onOpen={() => handleOpenInEditor('post')}
      />
    </div>
  );
}

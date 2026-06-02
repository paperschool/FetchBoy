import { useEffect, useState, useCallback } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { useScriptTemplateStore } from '@/stores/scriptTemplateStore';
import { t } from '@/lib/i18n';
import type { ScriptTemplate } from '@/lib/scriptTemplates';

interface ScriptTemplatePanelProps {
  /** Open a template in the editor (whole row is the click target). */
  onSelect: (template: ScriptTemplate) => void;
  /** Highlight the template currently open in the editor. */
  activeId?: string | null;
  /** When true, renders without outer border/header — intended for sidebar embedding. */
  embedded?: boolean;
  /** Close affordance for the non-embedded (standalone) layout. */
  onClose?: () => void;
}

export function ScriptTemplatePanel({ onSelect, activeId, embedded, onClose }: ScriptTemplatePanelProps): React.ReactElement {
  const templates = useScriptTemplateStore((s) => s.templates);
  const load = useScriptTemplateStore((s) => s.load);
  const remove = useScriptTemplateStore((s) => s.remove);

  const [search, setSearch] = useState('');

  useEffect(() => {
    void load().catch((err) => console.error('Failed to load script templates', err));
  }, [load]);

  const filtered = templates.filter((tmpl) =>
    tmpl.name.toLowerCase().includes(search.toLowerCase()) ||
    tmpl.description.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm(t('fetch.scriptLibrary.confirmDelete'))) return;
    await remove(id);
  }, [remove]);

  return (
    <div className={embedded ? "flex flex-1 flex-col min-h-0" : "border-app-subtle flex max-h-64 flex-col rounded border bg-app-sidebar"} data-testid="script-template-panel">
      {/* Header — hidden in embedded mode */}
      {!embedded && (
        <div className="flex items-center justify-between border-b border-app-subtle px-3 py-1.5">
          <span className="text-xs font-medium text-app-primary">{t('fetch.scriptLibrary.manageTemplates')}</span>
          {onClose && (
            <button onClick={onClose} className="text-app-muted hover:text-app-primary cursor-pointer" aria-label="Close">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className={`flex items-center gap-1.5 ${embedded ? 'border-b border-app-subtle pb-1.5 mb-1' : 'border-b border-app-subtle px-3 py-1'}`}>
        <Search size={12} className="text-app-muted" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('fetch.scriptLibrary.searchPlaceholder')}
          className="flex-1 bg-transparent text-xs text-app-primary outline-none placeholder:text-app-muted"
        />
      </div>

      {/* Template list — the whole row opens the template in the editor */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-app-muted">{t('fetch.scriptLibrary.noTemplates')}</div>
        )}
        {filtered.map((tmpl) => (
          <div
            key={tmpl.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(tmpl)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(tmpl); } }}
            className={`group flex cursor-pointer items-center gap-2 rounded border-b border-app-subtle px-3 py-1.5 hover:bg-app-main/50 ${activeId === tmpl.id ? 'bg-sky-400/10' : ''}`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-app-primary">{tmpl.name}</div>
              {tmpl.description && <div className="truncate text-[10px] text-app-muted">{tmpl.description}</div>}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); void handleDelete(tmpl.id); }}
              className="text-app-muted opacity-0 group-hover:opacity-100 hover:text-red-400 cursor-pointer"
              title={t('fetch.scriptLibrary.delete')}
              aria-label={t('fetch.scriptLibrary.delete')}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

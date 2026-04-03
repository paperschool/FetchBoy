import { useEffect, useState, useCallback } from 'react';
import { Search, Pencil, Trash2, X } from 'lucide-react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useScriptTemplateStore } from '@/stores/scriptTemplateStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { t } from '@/lib/i18n';
import type { ScriptTemplate } from '@/lib/scriptTemplates';

interface ScriptTemplatePanelProps {
  onInsert: (code: string) => void;
  onClose: () => void;
  /** When true, renders without outer border/header — intended for sidebar embedding */
  embedded?: boolean;
}

export function ScriptTemplatePanel({ onInsert, onClose, embedded }: ScriptTemplatePanelProps): React.ReactElement {
  const templates = useScriptTemplateStore((s) => s.templates);
  const load = useScriptTemplateStore((s) => s.load);
  const update = useScriptTemplateStore((s) => s.update);
  const remove = useScriptTemplateStore((s) => s.remove);
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ScriptTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');

  useEffect(() => { load(); }, [load]);

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase()),
  );

  const handleInsert = useCallback((tmpl: ScriptTemplate) => {
    onInsert(tmpl.code);
  }, [onInsert]);

  const handleEdit = useCallback((tmpl: ScriptTemplate) => {
    setEditing(tmpl);
    setEditName(tmpl.name);
    setEditCode(tmpl.code);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;
    await update(editing.id, { name: editName, code: editCode });
    setEditing(null);
  }, [editing, editName, editCode, update]);

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
          <button onClick={onClose} className="text-app-muted hover:text-app-primary cursor-pointer" aria-label="Close">
            <X size={14} />
          </button>
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

      {/* Editing view */}
      {editing ? (
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
            className="border-app-subtle rounded border bg-app-main px-2 py-1 text-xs text-app-primary" />
          <div className="flex-1 min-h-[80px]">
            <MonacoEditorField value={editCode} language="javascript" onChange={setEditCode}
              fontSize={fontSize - 2} path="template-edit" testId="template-edit-editor" height="80px" />
          </div>
          <div className="flex gap-1">
            <button onClick={handleSaveEdit}
              className="rounded bg-green-600 px-2 py-0.5 text-[10px] text-white hover:bg-green-700 cursor-pointer">
              {t('fetch.scriptLibrary.save')}
            </button>
            <button onClick={() => setEditing(null)}
              className="rounded bg-app-subtle px-2 py-0.5 text-[10px] text-app-secondary hover:bg-app-subtle/80 cursor-pointer">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        /* Template list */
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-app-muted">{t('fetch.scriptLibrary.noTemplates')}</div>
          )}
          {filtered.map((tmpl) => (
            <div key={tmpl.id} className="flex items-center gap-2 border-b border-app-subtle px-3 py-1.5 hover:bg-app-main/50">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-app-primary">{tmpl.name}</div>
                {tmpl.description && <div className="truncate text-[10px] text-app-muted">{tmpl.description}</div>}
              </div>
              <button onClick={() => handleInsert(tmpl)} title={t('fetch.scriptLibrary.insert')}
                className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[9px] text-blue-400 hover:bg-blue-600/30 cursor-pointer">
                {t('fetch.scriptLibrary.insert')}
              </button>
              <button onClick={() => handleEdit(tmpl)} className="text-app-muted hover:text-app-primary cursor-pointer" title={t('fetch.scriptLibrary.edit')}>
                <Pencil size={11} />
              </button>
              <button onClick={() => handleDelete(tmpl.id)} className="text-app-muted hover:text-red-400 cursor-pointer" title={t('fetch.scriptLibrary.delete')}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

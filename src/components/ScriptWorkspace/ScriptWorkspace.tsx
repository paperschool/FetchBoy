import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Plus, ArrowUpRight, BookmarkPlus, Play, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { ScriptTemplatePanel } from '@/components/MainPanel/components/ScriptTemplatePanel';
import { useTabStore } from '@/stores/tabStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useScriptTemplateStore } from '@/stores/scriptTemplateStore';
import { useAppTabStore } from '@/stores/appTabStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useScriptWorkspaceStore, type ScriptSlot } from '@/stores/scriptWorkspaceStore';
import { updateCollectionScript } from '@/lib/collections';
import { usePreRequestScript, type ScriptError } from '@/hooks/usePreRequestScript';
import { usePostResponseScript } from '@/hooks/usePostResponseScript';
import { t } from '@/lib/i18n';
import type { ScriptTemplate } from '@/lib/scriptTemplates';
import type { ConsoleLogEntry, TestResult } from '@/lib/scriptEngine';

interface RunOutput {
  status: 'running' | 'done' | 'error';
  consoleLogs: ConsoleLogEntry[];
  testResults?: TestResult[];
  error?: string;
  errorStack?: string;
}

const SLOTS: ScriptSlot[] = ['global', 'pre', 'post'];
const slotLabel = (slot: ScriptSlot): string =>
  slot === 'global' ? t('scripts.mode.global') : slot === 'pre' ? t('scripts.mode.preRequest') : t('scripts.mode.postResponse');
// Active-state colour per slot — matches the launcher accents / tab dots
// (global = sky, pre-request = amber, post-response = emerald).
const SLOT_ACTIVE_CLASS: Record<ScriptSlot, string> = {
  global: 'bg-sky-600 text-white',
  pre: 'bg-amber-600 text-white',
  post: 'bg-emerald-600 text-white',
};

export function ScriptWorkspace() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const editorFontSize = useUiSettingsStore((s) => s.editorFontSize);
  const createTemplate = useScriptTemplateStore((s) => s.create);
  const updateTemplate = useScriptTemplateStore((s) => s.update);
  const allTemplates = useScriptTemplateStore((s) => s.templates);
  const { executePreScript } = usePreRequestScript();
  const { executePostScript } = usePostResponseScript();

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  // Request context (for the header + the collection-wide "global" slot). Resolve from
  // the ACTIVE TAB's saved request id so it always reflects the request being edited
  // (robust across multiple open tabs), not the last-loaded global active request.
  const savedRequestId = activeTab?.requestState.savedRequestId ?? null;
  const request = useCollectionStore((s) => (savedRequestId ? s.requests.find((r) => r.id === savedRequestId) ?? null : null));
  const collection = useCollectionStore((s) => {
    const req = savedRequestId ? s.requests.find((r) => r.id === savedRequestId) : null;
    return req?.collection_id ? s.collections.find((c) => c.id === req.collection_id) ?? null : null;
  });
  const folders = useCollectionStore((s) => s.folders);
  const activeEnv = useEnvironmentStore((s) => s.environments.find((e) => e.is_active) ?? null);

  const [editingTemplate, setEditingTemplate] = useState<{ id: string; name: string; code: string } | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [scriptMode, setScriptMode] = useState<ScriptSlot>('pre');
  const [runOutput, setRunOutput] = useState<RunOutput | null>(null);
  const globalPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (globalPersistTimer.current) clearTimeout(globalPersistTimer.current); }, []);

  // Deep-link: a Fetch launcher can request a specific slot before switching tabs.
  const pendingMode = useScriptWorkspaceStore((s) => s.pendingMode);
  useEffect(() => {
    if (!pendingMode) return;
    setScriptMode(pendingMode === 'global' && !collection ? 'pre' : pendingMode);
    setEditingTemplate(null);
    setRunOutput(null);
    useScriptWorkspaceStore.getState().setPendingMode(null);
  }, [pendingMode, collection]);

  const goToRequest = useCallback(() => {
    useAppTabStore.getState().setActiveTab('fetch');
  }, []);

  // Breadcrumb: Collection › Folder › … (request name shown separately as the title).
  const breadcrumb: string[] = [];
  if (collection) {
    breadcrumb.push(collection.name);
    const chain: string[] = [];
    const seen = new Set<string>();
    let fid = request?.folder_id ?? null;
    while (fid && !seen.has(fid)) {
      seen.add(fid);
      const f = folders.find((x) => x.id === fid);
      if (!f) break;
      chain.unshift(f.name);
      fid = f.parent_id;
    }
    breadcrumb.push(...chain);
  }

  const handleGlobalChange = useCallback((value: string) => {
    if (!collection) return;
    // Authoring a non-empty global script implies intent to run it — never persist
    // it disabled (the workspace has no enable toggle). When clearing it, keep the
    // collection's existing flag.
    const enabled = value.trim() ? true : (collection.pre_request_script_enabled ?? true);
    const colId = collection.id;
    useCollectionStore.getState().setCollectionScript(colId, value, enabled);
    if (globalPersistTimer.current) clearTimeout(globalPersistTimer.current);
    globalPersistTimer.current = setTimeout(() => {
      void updateCollectionScript(colId, value, enabled).catch((e) => console.error('Failed to persist collection script', e));
    }, 500);
  }, [collection]);

  const applyToRequest = useCallback(
    (code: string) => {
      if (!activeTab) return;
      const current = scriptMode === 'post' ? activeTab.requestState.postResponseScript
        : scriptMode === 'global' ? (collection?.pre_request_script ?? '')
        : activeTab.requestState.preRequestScript;
      if (current.trim() && !window.confirm(t('scripts.templates.applyConfirm'))) return;
      if (scriptMode === 'global') { handleGlobalChange(code); return; }
      useTabStore.getState().updateTabRequestState(activeTabId,
        scriptMode === 'post' ? { postResponseScript: code, isDirty: true } : { preRequestScript: code, isDirty: true });
    },
    [activeTab, activeTabId, scriptMode, collection, handleGlobalChange],
  );

  const setRunError = useCallback((e: unknown) => {
    const err = e as ScriptError & { consoleLogs?: ConsoleLogEntry[] };
    const lineInfo = err.lineNumber ? ` (line ${err.lineNumber})` : '';
    setRunOutput({ status: 'error', consoleLogs: err.consoleLogs ?? [], error: `${err.message}${lineInfo}`, errorStack: err.stack });
  }, []);

  // Run any pre-request-style code (global / pre-request / a template) against the
  // active request's current field values.
  const runPreLike = useCallback(async (code: string) => {
    if (!activeTab) { setRunOutput({ status: 'error', consoleLogs: [], error: t('scripts.output.noRequest') }); return; }
    if (!code.trim()) { setRunOutput({ status: 'error', consoleLogs: [], error: t('scripts.output.emptyScript') }); return; }
    setRunOutput({ status: 'running', consoleLogs: [] });
    try {
      const rs = activeTab.requestState;
      const result = await executePreScript(code, {
        url: rs.url, method: rs.method, headers: rs.headers, queryParams: rs.queryParams, body: rs.body.raw,
      });
      setRunOutput({ status: 'done', consoleLogs: result.consoleLogs });
    } catch (e) { setRunError(e); }
  }, [activeTab, executePreScript, setRunError]);

  const runPost = useCallback(async () => {
    if (!activeTab) { setRunOutput({ status: 'error', consoleLogs: [], error: t('scripts.output.noRequest') }); return; }
    if (!activeTab.requestState.postResponseScript.trim()) { setRunOutput({ status: 'error', consoleLogs: [], error: t('scripts.output.emptyScript') }); return; }
    const resp = activeTab.responseState.responseData;
    if (!resp) { setRunOutput({ status: 'error', consoleLogs: [], error: t('scripts.output.needResponse') }); return; }
    setRunOutput({ status: 'running', consoleLogs: [] });
    try {
      const headersRecord: Record<string, string> = {};
      for (const h of resp.headers ?? []) headersRecord[h.key] = h.value;
      const result = await executePostScript(activeTab.requestState.postResponseScript, {
        status: resp.status, headers: headersRecord, body: resp.body, time: Number(resp.responseTimeMs),
      });
      setRunOutput({ status: 'done', consoleLogs: result.consoleLogs, testResults: result.testResults });
    } catch (e) { setRunError(e); }
  }, [activeTab, executePostScript, setRunError]);

  const handleRun = useCallback(() => {
    if (scriptMode === 'post') return runPost();
    const code = scriptMode === 'global' ? (collection?.pre_request_script ?? '') : (activeTab?.requestState.preRequestScript ?? '');
    return runPreLike(code);
  }, [scriptMode, collection, activeTab, runPost, runPreLike]);

  const startEditTemplate = useCallback(
    (tmpl: ScriptTemplate) => {
      setEditingTemplate((current) => {
        if (current && current.id !== tmpl.id) {
          const stored = allTemplates.find((s) => s.id === current.id);
          const dirty = stored ? stored.code !== current.code || stored.name !== current.name : true;
          if (dirty && !window.confirm('Discard unsaved changes to the current template?')) return current;
        }
        return { id: tmpl.id, name: tmpl.name, code: tmpl.code };
      });
    },
    [allTemplates],
  );

  const saveTemplateEdit = useCallback(async () => {
    if (!editingTemplate || !editingTemplate.name.trim()) return;
    await updateTemplate(editingTemplate.id, { name: editingTemplate.name.trim(), code: editingTemplate.code });
    setEditingTemplate(null);
  }, [editingTemplate, updateTemplate]);

  const createFromCurrent = useCallback(async () => {
    const name = newTemplateName.trim();
    if (!name) return;
    const code = activeTab?.requestState.preRequestScript ?? '';
    const created = await createTemplate(name, code);
    setNewTemplateName('');
    setEditingTemplate({ id: created.id, name: created.name, code: created.code });
  }, [newTemplateName, activeTab, createTemplate]);

  const passed = runOutput?.testResults?.filter((r) => r.passed).length ?? 0;
  const failed = runOutput?.testResults?.filter((r) => !r.passed).length ?? 0;

  const globalUnavailable = scriptMode === 'global' && !collection;
  const editorValue = scriptMode === 'global'
    ? (collection?.pre_request_script ?? '')
    : scriptMode === 'post'
      ? (activeTab?.requestState.postResponseScript ?? '')
      : (activeTab?.requestState.preRequestScript ?? '');

  const onEditorChange = (value: string) => {
    if (scriptMode === 'global') { handleGlobalChange(value); return; }
    if (!activeTab) return;
    useTabStore.getState().updateTabRequestState(activeTabId,
      scriptMode === 'post' ? { postResponseScript: value, isDirty: true } : { preRequestScript: value, isDirty: true });
  };

  // Shared Run output panel — shown in both request-script and template editing modes.
  const outputPanel = runOutput ? (
    <div className="flex max-h-52 shrink-0 flex-col border-t border-app-subtle bg-app-main" data-testid="script-workspace-output">
      <div className="flex items-center justify-between border-b border-app-subtle px-3 py-1.5">
        <span className="flex items-center gap-2 text-xs font-medium text-app-secondary">
          {t('scripts.output.title')}
          {runOutput.testResults && runOutput.testResults.length > 0 && (
            <span className="text-[10px] font-normal text-app-muted">
              {passed} {t('scripts.output.passed')}, {failed} {t('scripts.output.failed')}
            </span>
          )}
        </span>
        <button type="button" onClick={() => setRunOutput(null)} className="cursor-pointer text-[11px] text-app-muted hover:text-app-secondary">
          {t('scripts.output.clear')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 font-mono text-[11px] leading-relaxed">
        {runOutput.status === 'running' && <div className="text-app-muted">{t('scripts.running')}</div>}
        {runOutput.error && <div className="whitespace-pre-wrap font-medium text-red-400">{runOutput.error}</div>}
        {runOutput.errorStack && (
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[10px] text-red-300/80">{runOutput.errorStack}</pre>
        )}
        {runOutput.testResults?.map((r, i) => (
          <div key={i} className="flex items-start gap-1.5">
            {r.passed ? <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={12} className="mt-0.5 shrink-0 text-red-400" />}
            <span className={r.passed ? 'text-app-secondary' : 'text-red-300'}>{r.name}{r.error ? ` — ${r.error}` : ''}</span>
          </div>
        ))}
        {runOutput.consoleLogs.map((log, i) => (
          <div key={`c${i}`} className={log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-app-secondary'}>{log.args}</div>
        ))}
        {runOutput.status === 'done' && runOutput.consoleLogs.length === 0 && !runOutput.testResults?.length && (
          <div className="text-app-muted">{t('scripts.output.noConsole')}</div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="script-workspace">
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar: template manager (click a row to open in the editor) */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-app-subtle bg-app-main" data-testid="script-workspace-sidebar">
          <div className="border-b border-app-subtle px-3 py-2 text-xs font-medium text-app-secondary">
            {t('scripts.templates.heading')}
          </div>
          <div className="flex items-center gap-1.5 border-b border-app-subtle px-3 py-2">
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder={t('scripts.templates.namePlaceholder')}
              className="min-w-0 flex-1 rounded border border-app-subtle bg-app-main px-2 py-1 text-xs text-app-primary outline-none placeholder:text-app-muted"
            />
            <button
              type="button"
              onClick={() => void createFromCurrent()}
              disabled={!newTemplateName.trim()}
              title={t('scripts.templates.create')}
              aria-label={t('scripts.templates.create')}
              className="shrink-0 cursor-pointer rounded bg-green-600 p-1 text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-2">
            <ScriptTemplatePanel onSelect={startEditTemplate} activeId={editingTemplate?.id ?? null} embedded />
          </div>
        </aside>

        {/* Center editor region */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="script-workspace-editor">
          {editingTemplate ? (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-app-subtle bg-app-sidebar/40 px-3 py-2">
                <Pencil size={13} className="shrink-0 text-sky-400" />
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-app-subtle bg-app-main px-2 py-1 text-sm text-app-primary outline-none"
                  aria-label={t('scripts.templates.editing')}
                />
                <button type="button" onClick={() => void runPreLike(editingTemplate.code)} disabled={runOutput?.status === 'running'}
                  title={t('scripts.run.preTitle')}
                  className="flex shrink-0 items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                  <Play size={12} />
                  {runOutput?.status === 'running' ? t('scripts.running') : t('scripts.run')}
                </button>
                {activeTab && (
                  <button type="button" onClick={() => applyToRequest(editingTemplate.code)} title={t('scripts.applyToRequest')}
                    className="shrink-0 cursor-pointer rounded bg-blue-600/20 px-2 py-1 text-xs font-medium text-blue-400 hover:bg-blue-600/30">
                    <BookmarkPlus size={12} className="mr-1 inline" />
                    {t('scripts.applyToRequest')}
                  </button>
                )}
                <button type="button" onClick={() => void saveTemplateEdit()}
                  className="shrink-0 cursor-pointer rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700">
                  {t('fetch.scriptLibrary.save')}
                </button>
                <button type="button" onClick={() => setEditingTemplate(null)}
                  className="shrink-0 cursor-pointer rounded bg-app-subtle px-2.5 py-1 text-xs text-app-secondary hover:bg-app-subtle/80">
                  {t('common.cancel')}
                </button>
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2">
                <MonacoEditorField
                  testId="workspace-template-editor"
                  path={`workspace-template-${editingTemplate.id}`}
                  language="javascript"
                  fbApiStage="all"
                  height="100%"
                  value={editingTemplate.code}
                  fontSize={editorFontSize}
                  borderClassName="border-sky-400/50"
                  onChange={(value) => setEditingTemplate({ ...editingTemplate, code: value })}
                />
              </div>
              {outputPanel}
            </>
          ) : activeTab ? (
            <>
              {/* Rich request header */}
              <div className="flex shrink-0 flex-col gap-2 border-b border-app-subtle bg-app-sidebar/40 px-4 py-3" data-testid="script-workspace-header">
                {breadcrumb.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-app-muted">
                    {breadcrumb.map((part, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight size={11} className="text-app-muted/60" />}
                        <span className="truncate">{part}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded bg-app-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold text-app-secondary">
                    {activeTab.requestState.method}
                  </span>
                  <span className="truncate text-sm font-semibold text-app-primary">{request?.name ?? activeTab.label}</span>
                  <button type="button" onClick={goToRequest} title={t('scripts.openRequestTitle')}
                    className="ml-auto flex shrink-0 items-center gap-1 rounded border border-app-subtle px-2 py-0.5 text-[11px] text-app-secondary hover:bg-app-hover hover:text-app-primary">
                    {t('scripts.openInFetch')}
                    <ArrowUpRight size={12} />
                  </button>
                </div>
                {activeTab.requestState.url && (
                  <div className="truncate font-mono text-[11px] text-app-muted">{activeTab.requestState.url}</div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex overflow-hidden rounded border border-app-subtle text-xs">
                    {SLOTS.filter((m) => m !== 'global' || collection).map((m) => (
                      <button key={m} type="button" onClick={() => setScriptMode(m)}
                        className={`px-2 py-0.5 ${scriptMode === m ? SLOT_ACTIVE_CLASS[m] : 'text-app-muted hover:text-app-secondary'}`}>
                        {slotLabel(m)}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => void handleRun()} disabled={runOutput?.status === 'running' || globalUnavailable}
                    title={scriptMode === 'post' ? t('scripts.run.postTitle') : t('scripts.run.preTitle')}
                    className="flex shrink-0 items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                    <Play size={12} />
                    {runOutput?.status === 'running' ? t('scripts.running') : t('scripts.run')}
                  </button>
                </div>
                {activeEnv && (
                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-app-muted">
                    <span className="font-medium text-app-secondary">{activeEnv.name}:</span>
                    {activeEnv.variables.filter((v) => v.enabled && v.key).length === 0 && <span>{t('scripts.env.none')}</span>}
                    {activeEnv.variables.filter((v) => v.enabled && v.key).map((v) => (
                      <span key={v.key} className="rounded bg-app-subtle px-1.5 py-0.5 font-mono">{`{{${v.key}}}`}</span>
                    ))}
                  </div>
                )}
              </div>

              {globalUnavailable ? (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-app-muted" data-testid="script-workspace-global-unavailable">
                  {t('scripts.globalUnavailable')}
                </div>
              ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2">
                  <MonacoEditorField
                    testId={scriptMode === 'global' ? 'workspace-global-editor' : scriptMode === 'pre' ? 'workspace-pre-request-editor' : 'workspace-post-response-editor'}
                    path={`workspace-${scriptMode}-${scriptMode === 'global' ? (collection?.id ?? 'none') : activeTab.id}`}
                    language="javascript"
                    fbApiStage={scriptMode === 'post' ? 'post' : 'pre'}
                    height="100%"
                    value={editorValue}
                    fontSize={editorFontSize}
                    onChange={onEditorChange}
                  />
                </div>
              )}

              {outputPanel}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center" data-testid="script-workspace-empty">
              <p className="text-sm font-medium text-app-secondary">{t('scripts.empty.title')}</p>
              <p className="max-w-xs text-xs text-app-muted">{t('scripts.empty.body')}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

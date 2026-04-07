import { useState, useCallback } from 'react';
import { PanelLeftClose, PanelLeftOpen, BookmarkPlus, Code, Workflow } from 'lucide-react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { ScriptTemplatePanel } from './ScriptTemplatePanel';
import { PreRequestDebugLog } from './PreRequestDebugLog';
import { PreRequestModeChooser } from './PreRequestModeChooser';
import { useScriptTemplateStore } from '@/stores/scriptTemplateStore';
import { useStitchStore } from '@/stores/stitchStore';
import { useAppTabStore } from '@/stores/appTabStore';
import { DEFAULT_FETCH_TERMINAL_CONFIG } from '@/types/stitch';
import { t } from '@/lib/i18n';
import type { ScriptDebugState } from '@/stores/tabStore';

const PLACEHOLDER = `// ── Pre-request Script API ──────────────────────────
//
// fb.env.get(key)              → read an environment variable
// fb.env.set(key, value)       → write an environment variable (persisted)
//
// fb.request.url               → read / write the request URL
// fb.request.method            → read the HTTP method (read-only)
// fb.request.headers           → read / write headers  [{ key, value, enabled }]
// fb.request.queryParams       → read / write params   [{ key, value, enabled }]
// fb.request.body              → read / write the body string
//
// fb.http.get(url, opts?)      → { status, headers, body }
// fb.http.post(url, opts?)     → { status, headers, body }
// fb.http.put(url, opts?)      → { status, headers, body }
// fb.http.patch(url, opts?)    → { status, headers, body }
// fb.http.delete(url, opts?)   → { status, headers, body }
//   opts: { headers?: {}, body?: string }
//
// fb.utils.uuid()              → UUID v4
// fb.utils.timestamp()         → Unix seconds
// fb.utils.timestampMs()       → Unix milliseconds
// fb.utils.base64Encode(str)   → Base-64 encode
// fb.utils.base64Decode(str)   → Base-64 decode
// fb.utils.sha256(str)         → SHA-256 hex digest
// fb.utils.hmacSha256(key,str) → HMAC-SHA-256 hex digest
//
// console.log/warn/error(...)  → captured in debug panel
`;

interface ScriptsTabProps {
  script: string;
  enabled: boolean;
  keepOpen: boolean;
  onScriptChange: (script: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onKeepOpenChange: (keepOpen: boolean) => void;
  editorFontSize: number;
  scriptDebugState?: ScriptDebugState;
  onDebugClose?: () => void;
  preRequestMode: 'none' | 'javascript' | 'chain';
  onModeChange: (mode: 'none' | 'javascript' | 'chain') => void;
  preRequestChainId: string | null;
  onChainIdChange: (chainId: string | null) => void;
}

export function ScriptsTab({
  script, enabled, keepOpen, onScriptChange, onEnabledChange, onKeepOpenChange,
  editorFontSize, scriptDebugState, onDebugClose,
  preRequestMode, onModeChange, preRequestChainId, onChainIdChange,
}: ScriptsTabProps): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const createTemplate = useScriptTemplateStore((s) => s.create);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim() || !script.trim()) return;
    await createTemplate(templateName.trim(), script, templateDesc.trim());
    setTemplateName('');
    setTemplateDesc('');
  }, [templateName, templateDesc, script, createTemplate]);

  const handleInsertTemplate = useCallback((code: string) => {
    if (script.trim() && script !== PLACEHOLDER) {
      if (!window.confirm(t('fetch.scriptLibrary.confirmReplace'))) return;
    }
    onScriptChange(code);
  }, [script, onScriptChange]);

  const handleChooseJavaScript = useCallback(() => {
    onModeChange('javascript');
    onEnabledChange(true);
  }, [onModeChange, onEnabledChange]);

  const handleChooseChain = useCallback(async () => {
    try {
      onModeChange('chain');
      const stitchStore = useStitchStore.getState();
      if (preRequestChainId) {
        const existing = stitchStore.chains.find((c) => c.id === preRequestChainId);
        if (existing) {
          await stitchStore.loadChain(preRequestChainId);
          useAppTabStore.getState().setActiveTab('stitch');
          return;
        }
      }
      // Create new pre-request chain with a fetch-terminal end node
      // Pass 'pre-request' as requestId so the sidebar shows the fetch badge
      const chain = await stitchStore.createChain('Pre-Request', null, null, 'pre-request');
      await stitchStore.loadChain(chain.id);
      await stitchStore.addNode({
        chainId: chain.id,
        type: 'fetch-terminal',
        positionX: 250,
        positionY: 300,
        config: { ...DEFAULT_FETCH_TERMINAL_CONFIG },
        label: 'Fetch Request',
        parentNodeId: null,
      });
      onChainIdChange(chain.id);
      useAppTabStore.getState().setActiveTab('stitch');
    } catch (err) {
      console.error('[ScriptsTab] Failed to create pre-request chain:', err);
    }
  }, [onModeChange, preRequestChainId, onChainIdChange]);

  const handleSwitchBack = useCallback(() => {
    onModeChange('none');
  }, [onModeChange]);

  // Mode chooser: show when no mode is active
  if (preRequestMode === 'none') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 mb-2">
          <label className="text-app-secondary block text-sm font-medium">
            {t('fetch.preRequestScript')}
          </label>
        </div>
        <PreRequestModeChooser onChooseJavaScript={handleChooseJavaScript} onChooseChain={handleChooseChain} />
      </div>
    );
  }

  // Chain mode: show embedded stitch canvas placeholder + mode indicator
  if (preRequestMode === 'chain') {
    return (
      <div className="flex min-h-0 flex-col space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Workflow size={14} className="text-teal-400" />
            <label className="text-app-secondary text-sm font-medium">{t('fetch.preRequestScript')}</label>
            <span className="rounded bg-teal-500/15 px-2 py-0.5 text-[10px] font-medium text-teal-400">Chain</span>
          </div>
          <button
            type="button"
            onClick={handleSwitchBack}
            className="cursor-pointer rounded px-2 py-1 text-xs text-app-muted hover:bg-app-hover hover:text-app-secondary"
          >
            {t('fetch.switchToJs')}
          </button>
        </div>
        <div className="flex items-center justify-center rounded border border-dashed border-app-subtle bg-app-sidebar/50 py-8">
          <div className="text-center">
            <Workflow size={32} className="mx-auto mb-2 text-teal-400/40" />
            <p className="text-xs text-app-muted">Pre-request chain active</p>
            <button
              type="button"
              className="mt-3 cursor-pointer rounded bg-teal-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-teal-500"
              onClick={() => {
                if (preRequestChainId) {
                  useStitchStore.getState().loadChain(preRequestChainId).catch(() => {});
                }
                useAppTabStore.getState().setActiveTab('stitch');
              }}
            >
              Open in Stitch
            </button>
          </div>
        </div>
      </div>
    );
  }

  // JavaScript mode: existing editor
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? t('fetch.scriptLibrary.hideSidebar') : t('fetch.scriptLibrary.showSidebar')}
            className="text-app-muted hover:text-app-primary cursor-pointer" aria-label="Toggle template sidebar">
            {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>
          <Code size={14} className="text-amber-400" />
          <label className="text-app-secondary text-sm font-medium">{t('fetch.preRequestScript')}</label>
          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">JS</span>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={handleSwitchBack}
            className="cursor-pointer rounded px-2 py-1 text-xs text-app-muted hover:bg-app-hover hover:text-app-secondary">
            {t('fetch.switchToChain')}
          </button>
          <label className="text-app-secondary inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={keepOpen} onChange={(e) => onKeepOpenChange(e.target.checked)} aria-label="Keep script tab open after send" />
            Keep Open
          </label>
          <label className="text-app-secondary inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} aria-label="Enable pre-request script" />
            Enabled
          </label>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        {sidebarOpen && (
          <div className="relative z-10 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-app-subtle pr-2">
            <div className="mb-2 flex flex-col gap-1.5 rounded border border-app-subtle bg-app-sidebar p-2">
              <div className="flex items-center gap-1.5">
                <BookmarkPlus size={12} className="shrink-0 text-app-muted" />
                <span className="text-[10px] font-medium text-app-secondary">{t('fetch.scriptLibrary.saveAsTemplate')}</span>
              </div>
              <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t('fetch.scriptLibrary.templateName')}
                className="rounded border border-app-subtle bg-app-main px-2 py-1 text-xs text-app-primary outline-none placeholder:text-app-muted" />
              <input type="text" value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder={t('fetch.scriptLibrary.templateDescription')}
                className="rounded border border-app-subtle bg-app-main px-2 py-1 text-xs text-app-primary outline-none placeholder:text-app-muted" />
              <button type="button" onClick={handleSaveTemplate} disabled={!templateName.trim() || !script.trim()}
                className="rounded bg-green-600 px-2 py-1 text-[10px] text-white hover:bg-green-700 cursor-pointer disabled:opacity-50">
                {t('fetch.scriptLibrary.save')}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ScriptTemplatePanel onInsert={handleInsertTemplate} onClose={() => setSidebarOpen(false)} embedded />
            </div>
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MonacoEditorField testId="pre-request-script-editor" path="pre-request-script" language="javascript"
            value={script || PLACEHOLDER} fontSize={editorFontSize}
            onChange={(value) => { onScriptChange(value === PLACEHOLDER ? "" : value); }} />
          {scriptDebugState && scriptDebugState.status !== 'idle' && onDebugClose && (
            <PreRequestDebugLog debugState={scriptDebugState} onClose={onDebugClose} />
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { PanelLeftClose, PanelLeftOpen, BookmarkPlus } from 'lucide-react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { ScriptTemplatePanel } from './ScriptTemplatePanel';
import { PreRequestDebugLog } from './PreRequestDebugLog';
import { useScriptTemplateStore } from '@/stores/scriptTemplateStore';
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
//
// Example: fetch a bearer token before the request
// var auth = fb.http.post("https://auth.example.com/token", {
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify({ client_id: fb.env.get("CLIENT_ID") }),
// });
// fb.env.set("TOKEN", JSON.parse(auth.body).access_token);
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
}

export function ScriptsTab({
  script,
  enabled,
  keepOpen,
  onScriptChange,
  onEnabledChange,
  onKeepOpenChange,
  editorFontSize,
  scriptDebugState,
  onDebugClose,
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

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? t('fetch.scriptLibrary.hideSidebar') : t('fetch.scriptLibrary.showSidebar')}
            className="text-app-muted hover:text-app-primary cursor-pointer"
            aria-label="Toggle template sidebar"
          >
            {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>
          <label className="text-app-secondary block text-sm font-medium">
            {t('fetch.preRequestScript')}
          </label>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-app-secondary inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={keepOpen}
              onChange={(e) => onKeepOpenChange(e.target.checked)}
              aria-label="Keep script tab open after send"
            />
            Keep Open
          </label>
          <label className="text-app-secondary inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
              aria-label="Enable pre-request script"
            />
            Enabled
          </label>
        </div>
      </div>

      {/* Main content: sidebar + editor/debug */}
      <div className="flex min-h-0 flex-1 gap-2">
        {/* Template sidebar */}
        {sidebarOpen && (
          <div className="relative z-10 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-app-subtle pr-2">
            {/* Save template form */}
            <div className="mb-2 flex flex-col gap-1.5 rounded border border-app-subtle bg-app-sidebar p-2">
              <div className="flex items-center gap-1.5">
                <BookmarkPlus size={12} className="shrink-0 text-app-muted" />
                <span className="text-[10px] font-medium text-app-secondary">{t('fetch.scriptLibrary.saveAsTemplate')}</span>
              </div>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t('fetch.scriptLibrary.templateName')}
                className="rounded border border-app-subtle bg-app-main px-2 py-1 text-xs text-app-primary outline-none placeholder:text-app-muted"
              />
              <input
                type="text"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder={t('fetch.scriptLibrary.templateDescription')}
                className="rounded border border-app-subtle bg-app-main px-2 py-1 text-xs text-app-primary outline-none placeholder:text-app-muted"
              />
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || !script.trim()}
                className="rounded bg-green-600 px-2 py-1 text-[10px] text-white hover:bg-green-700 cursor-pointer disabled:opacity-50"
              >
                {t('fetch.scriptLibrary.save')}
              </button>
            </div>

            {/* Template list */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <ScriptTemplatePanel onInsert={handleInsertTemplate} onClose={() => setSidebarOpen(false)} embedded />
            </div>
          </div>
        )}

        {/* Editor + debug */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MonacoEditorField
            testId="pre-request-script-editor"
            path="pre-request-script"
            language="javascript"
            value={script || PLACEHOLDER}
            fontSize={editorFontSize}
            onChange={(value) => {
              onScriptChange(value === PLACEHOLDER ? "" : value);
            }}
          />

          {scriptDebugState && scriptDebugState.status !== 'idle' && onDebugClose && (
            <PreRequestDebugLog debugState={scriptDebugState} onClose={onDebugClose} />
          )}
        </div>
      </div>
    </div>
  );
}

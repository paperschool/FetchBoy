import { useState } from 'react';
import { ChevronRight, ChevronDown, Globe, CheckCircle2, XCircle } from 'lucide-react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { t } from '@/lib/i18n';
import type { ScriptDebugState } from '@/stores/tabStore';

const STATUS_STYLES: Record<ScriptDebugState['status'], { label: string; className: string }> = {
  idle: { label: 'fetch.scriptDebug.idle', className: 'text-app-muted' },
  running: { label: 'fetch.scriptDebug.running', className: 'text-blue-400 animate-pulse' },
  completed: { label: 'fetch.scriptDebug.completed', className: 'text-green-400' },
  error: { label: 'fetch.scriptDebug.error', className: 'text-red-400' },
};

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export function scriptStageRan(debug: ScriptDebugState | undefined): boolean {
  return !!debug && debug.status !== 'idle';
}

/** One stage's execution output (console, http sub-requests, tests, error, snapshots). */
function StageSection({ title, accent, debug }: { title: string; accent: string; debug: ScriptDebugState }) {
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const { status, consoleLogs, httpLogs, error, startTime, endTime, inputSnapshot, outputSnapshot, testResults } = debug;
  const durationMs = startTime && endTime ? endTime - startTime : null;
  const statusInfo = STATUS_STYLES[status];
  const passed = testResults?.filter((r) => r.passed).length ?? 0;
  const failed = testResults?.filter((r) => !r.passed).length ?? 0;

  return (
    <div className="rounded border border-app-subtle">
      <div className="flex items-center gap-2 border-b border-app-subtle bg-app-subtle px-3 py-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${accent}`} />
        <span className="text-xs font-medium text-app-primary">{title}</span>
        <span className={`text-[10px] font-medium ${statusInfo.className}`}>{t(statusInfo.label as Parameters<typeof t>[0])}</span>
        {durationMs !== null && <span className="text-[10px] font-mono text-app-muted">{formatDuration(durationMs)}</span>}
        {testResults && testResults.length > 0 && (
          <span className="text-[10px] text-app-muted">{passed} {t('scripts.output.passed')}, {failed} {t('scripts.output.failed')}</span>
        )}
      </div>

      <div className="space-y-1 px-3 py-2 font-mono text-[11px]">
        {/* HTTP sub-requests */}
        {httpLogs.map((log, i) => (
          <div key={`h${i}`} className="flex items-center gap-2">
            <Globe size={10} className="shrink-0 text-app-muted" />
            <span className="rounded bg-blue-500/15 px-1 py-0.5 text-[9px] font-medium text-blue-400">{log.method}</span>
            <span className="min-w-0 flex-1 truncate text-app-secondary" title={log.url}>{log.url}</span>
            <span className={log.status >= 200 && log.status < 400 ? 'text-green-400' : 'text-red-400'}>{log.status || '—'}</span>
            <span className="text-app-muted">{formatDuration(log.durationMs)}</span>
          </div>
        ))}

        {/* Test results */}
        {testResults?.map((r, i) => (
          <div key={`t${i}`} className="flex items-start gap-1.5">
            {r.passed ? <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-400" /> : <XCircle size={12} className="mt-0.5 shrink-0 text-red-400" />}
            <span className={r.passed ? 'text-app-secondary' : 'text-red-300'}>{r.name}{r.error ? ` — ${r.error}` : ''}</span>
          </div>
        ))}

        {/* Console logs */}
        {consoleLogs.map((log, i) => (
          <div key={`c${i}`} className={`flex items-start gap-1.5 ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-app-secondary'}`}>
            <span className="shrink-0 text-[9px] text-app-muted">{log.level === 'error' ? '✕' : log.level === 'warn' ? '⚠' : '›'}</span>
            <span className="whitespace-pre-wrap break-all">{log.args}</span>
          </div>
        ))}

        {/* Error + stack */}
        {error && (
          <div className="rounded bg-red-500/15 px-2 py-1.5 text-red-400">
            <div className="font-medium">
              {error.lineNumber && <span className="mr-1">Line {error.lineNumber}:</span>}
              {error.message}
            </div>
            {error.stack && (
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] text-red-300/80">{error.stack}</pre>
            )}
          </div>
        )}

        {/* Nothing produced */}
        {status === 'completed' && consoleLogs.length === 0 && httpLogs.length === 0 && !testResults?.length && !error && (
          <div className="text-app-muted">{t('scripts.output.noConsole')}</div>
        )}

        {/* Input/Output snapshots */}
        {inputSnapshot && (
          <div>
            <button className="flex items-center gap-1 text-[10px] text-app-muted hover:text-app-secondary" onClick={() => setInputExpanded((p) => !p)}>
              {inputExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              {t('fetch.scriptDebug.inputContext')}
            </button>
            {inputExpanded && (
              <MonacoEditorField value={JSON.stringify(inputSnapshot, null, 2)} language="json" readOnly fontSize={fontSize - 2} path={`script-out-input-${title}`} testId="script-out-input" height="120px" />
            )}
          </div>
        )}
        {outputSnapshot && (
          <div>
            <button className="flex items-center gap-1 text-[10px] text-app-muted hover:text-app-secondary" onClick={() => setOutputExpanded((p) => !p)}>
              {outputExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              {t('fetch.scriptDebug.outputContext')}
            </button>
            {outputExpanded && (
              <MonacoEditorField value={JSON.stringify(outputSnapshot, null, 2)} language="json" readOnly fontSize={fontSize - 2} path={`script-out-output-${title}`} testId="script-out-output" height="120px" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Full-height Script Output panel for the response viewer — shows each stage that ran. */
export function ScriptOutputPanel({ global, pre, post }: { global: ScriptDebugState; pre: ScriptDebugState; post: ScriptDebugState }) {
  const hasGlobal = scriptStageRan(global);
  const hasPre = scriptStageRan(pre);
  const hasPost = scriptStageRan(post);

  if (!hasGlobal && !hasPre && !hasPost) {
    return <p className="text-app-muted text-sm" data-testid="script-output-empty">{t('scripts.output.sendToRun')}</p>;
  }

  return (
    <div className="h-full space-y-2 overflow-y-auto" data-testid="script-output-panel">
      {hasGlobal && <StageSection title={t('scripts.globalScriptTitle')} accent="bg-sky-400" debug={global} />}
      {hasPre && <StageSection title={t('scripts.mode.preRequest')} accent="bg-amber-400" debug={pre} />}
      {hasPost && <StageSection title={t('scripts.mode.postResponse')} accent="bg-emerald-400" debug={post} />}
    </div>
  );
}

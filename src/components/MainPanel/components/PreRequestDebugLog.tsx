import { useRef, useEffect, useState, useCallback } from 'react';
import { X, ChevronRight, ChevronDown, Globe } from 'lucide-react';
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

interface PreRequestDebugLogProps {
  debugState: ScriptDebugState;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export function PreRequestDebugLog({ debugState, onClose }: PreRequestDebugLogProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);

  const { status, consoleLogs, httpLogs, error, startTime, endTime, inputSnapshot, outputSnapshot } = debugState;
  const durationMs = startTime && endTime ? endTime - startTime : null;
  const statusInfo = STATUS_STYLES[status];
  const hasContent = consoleLogs.length > 0 || httpLogs.length > 0 || error;

  // Auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledRef.current = distFromBottom > 30;
  }, []);

  useEffect(() => {
    if (!userScrolledRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleLogs.length, httpLogs.length, error]);

  const toggleInput = useCallback(() => setInputExpanded((p) => !p), []);
  const toggleOutput = useCallback(() => setOutputExpanded((p) => !p), []);

  return (
    <div className="border-t border-app-subtle bg-app-sidebar flex max-h-64 flex-col" data-testid="pre-request-debug-log">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-app-subtle px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-app-primary">{t('fetch.scriptDebug.title')}</span>
          <span className={`text-[10px] font-medium ${statusInfo.className}`}>
            {t(statusInfo.label as Parameters<typeof t>[0])}
          </span>
          {durationMs !== null && (
            <span className="text-[10px] font-mono text-app-muted">{formatDuration(durationMs)}</span>
          )}
        </div>
        <button onClick={onClose} className="text-app-muted hover:text-app-primary" aria-label="Close">
          <X size={14} />
        </button>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {!hasContent && status === 'idle' && (
          <div className="px-3 py-4 text-center text-xs text-app-muted">{t('fetch.scriptDebug.noLogs')}</div>
        )}

        {/* HTTP sub-requests */}
        {httpLogs.map((log, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-app-subtle px-3 py-1" data-testid="http-log-entry">
            <Globe size={10} className="shrink-0 text-app-muted" />
            <span className="rounded bg-blue-500/15 px-1 py-0.5 text-[9px] font-medium text-blue-400">{log.method}</span>
            <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-app-secondary" title={log.url}>{log.url}</span>
            <span className={`text-[10px] font-medium ${log.status >= 200 && log.status < 400 ? 'text-green-400' : 'text-red-400'}`}>
              {log.status || '—'}
            </span>
            <span className="text-[10px] font-mono text-app-muted">{formatDuration(log.durationMs)}</span>
          </div>
        ))}

        {/* Console logs */}
        {consoleLogs.map((log, i) => (
          <div
            key={i}
            className={`flex items-start gap-1.5 border-b border-app-subtle px-3 py-1 font-mono text-[10px] ${
              log.level === 'error' ? 'bg-red-500/10 text-red-400'
              : log.level === 'warn' ? 'bg-yellow-500/10 text-yellow-400'
              : 'text-app-secondary'
            }`}
            data-testid="console-log-entry"
          >
            <span className="shrink-0 text-[9px] text-app-muted">
              {log.level === 'error' ? '✕' : log.level === 'warn' ? '⚠' : '›'}
            </span>
            <span className="whitespace-pre-wrap break-all">{log.args}</span>
          </div>
        ))}

        {/* Error */}
        {error && (
          <div className="mx-3 my-1.5 rounded bg-red-500/15 px-2 py-1 text-xs text-red-400" data-testid="script-error">
            {error.lineNumber && <span className="mr-1 font-medium">Line {error.lineNumber}:</span>}
            {error.message}
          </div>
        )}

        {/* Input/Output context viewers */}
        {inputSnapshot && (
          <div className="px-3 py-1">
            <button className="flex items-center gap-1 text-[10px] text-app-muted hover:text-app-secondary" onClick={toggleInput}>
              {inputExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              {t('fetch.scriptDebug.inputContext')}
            </button>
            {inputExpanded && (
              <div className="mt-0.5">
                <MonacoEditorField value={JSON.stringify(inputSnapshot, null, 2)} language="json" readOnly
                  fontSize={fontSize - 2} path="script-debug-input" testId="debug-input-editor" height="120px" />
              </div>
            )}
          </div>
        )}
        {outputSnapshot && (
          <div className="px-3 py-1">
            <button className="flex items-center gap-1 text-[10px] text-app-muted hover:text-app-secondary" onClick={toggleOutput}>
              {outputExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              {t('fetch.scriptDebug.outputContext')}
            </button>
            {outputExpanded && (
              <div className="mt-0.5">
                <MonacoEditorField value={JSON.stringify(outputSnapshot, null, 2)} language="json" readOnly
                  fontSize={fontSize - 2} path="script-debug-output" testId="debug-output-editor" height="120px" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

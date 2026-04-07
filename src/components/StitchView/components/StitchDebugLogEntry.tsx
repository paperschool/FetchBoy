import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Send, Code, Braces, Timer, Repeat, GitMerge, GitBranch, Globe, ArrowDownToLine, ArrowUpFromLine, CircleStop } from 'lucide-react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import type { ExecutionLogEntry, StitchNodeType } from '@/types/stitch';

const NODE_ICONS: Record<StitchNodeType, React.ReactNode> = {
  'request': <Send size={11} />,
  'js-snippet': <Code size={11} />,
  'json-object': <Braces size={11} />,
  'sleep': <Timer size={11} />,
  'loop': <Repeat size={11} />,
  'merge': <GitMerge size={11} />,
  'condition': <GitBranch size={11} />,
  'mapping': <Globe size={11} />,
  'mapping-entry': <ArrowDownToLine size={11} />,
  'mapping-exit': <ArrowUpFromLine size={11} />,
  'fetch-terminal': <CircleStop size={11} />,
};

const STATUS_COLORS: Record<string, string> = {
  started: 'text-blue-400',
  completed: 'text-green-400',
  error: 'text-red-400',
  sleeping: 'text-purple-400',
  cancelled: 'text-yellow-400',
  skipped: 'text-gray-500',
  replayed: 'text-blue-300',
};

interface StitchDebugLogEntryProps {
  entry: ExecutionLogEntry;
  isError: boolean;
}

function formatTimestamp(ms: number): string {
  return `+${(ms / 1000).toFixed(2)}s`;
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export function StitchDebugLogEntry({ entry, isError }: StitchDebugLogEntryProps): React.ReactElement {
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);

  const toggleInput = useCallback((): void => setInputExpanded((p) => !p), []);
  const toggleOutput = useCallback((): void => setOutputExpanded((p) => !p), []);

  const isLoopChild = entry.loopNodeId !== undefined;
  const isSkipped = entry.status === 'skipped';
  const isReplayed = entry.status === 'replayed';

  return (
    <div
      className={`border-b border-app-subtle py-1.5 ${isError ? 'bg-red-500/10' : ''} ${isReplayed ? 'bg-blue-500/5' : ''} ${isSkipped ? 'opacity-40' : ''} ${isLoopChild ? 'pl-7 pr-3 border-l-2 border-l-cyan-500/30' : 'px-3'}`}
      data-testid={`debug-log-entry-${entry.nodeId}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-app-muted">{formatTimestamp(entry.timestamp)}</span>
        {isLoopChild && (
          <span className="rounded bg-cyan-500/15 px-1 py-0.5 text-[8px] font-medium text-cyan-600 dark:text-cyan-400">
            [{entry.loopIteration}]
          </span>
        )}
        {entry.parallel && (
          <span className="rounded bg-indigo-500/15 px-1 py-0.5 text-[8px] font-medium text-indigo-600 dark:text-indigo-400" data-testid="parallel-badge">
            parallel
          </span>
        )}
        {entry.conditionResult !== undefined && (
          <span className={`rounded px-1 py-0.5 text-[8px] font-medium ${entry.conditionResult ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`} data-testid="condition-badge">
            → {String(entry.conditionResult)}
          </span>
        )}
        <span className="text-app-secondary">{NODE_ICONS[entry.nodeType]}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-app-primary">
          {entry.nodeLabel || entry.nodeType}
        </span>
        <span className={`text-[10px] font-medium ${STATUS_COLORS[entry.status] ?? 'text-app-muted'}`}>
          {entry.status}
        </span>
        {entry.durationMs !== undefined && (
          <span className="text-[10px] font-mono text-app-muted">{formatDuration(entry.durationMs)}</span>
        )}
      </div>

      {entry.url && (
        <div className="mt-0.5 truncate text-[10px] font-mono text-app-muted" title={entry.url}>
          {entry.url}
        </div>
      )}

      {entry.error && (
        <div className="mt-1 rounded bg-red-500/15 px-2 py-1 text-xs text-red-400" data-testid="log-error-message">
          {entry.error}
        </div>
      )}

      {entry.consoleLogs && entry.consoleLogs.length > 0 && (
        <div className="mt-1 space-y-0.5" data-testid="console-logs">
          {entry.consoleLogs.map((log, i) => (
            <div
              key={i}
              className={`flex items-start gap-1.5 rounded px-2 py-0.5 font-mono text-[10px] ${
                log.level === 'error' ? 'bg-red-500/10 text-red-400'
                : log.level === 'warn' ? 'bg-yellow-500/10 text-yellow-400'
                : 'bg-app-sidebar text-app-secondary'
              }`}
            >
              <span className="shrink-0 text-[9px] text-app-muted">
                {log.level === 'error' ? '✕' : log.level === 'warn' ? '⚠' : '›'}
              </span>
              <span className="whitespace-pre-wrap break-all">{log.args}</span>
            </div>
          ))}
        </div>
      )}

      {entry.input && Object.keys(entry.input).length > 0 && (
        <div className="mt-1">
          <button className="flex items-center gap-1 text-[10px] text-app-muted hover:text-app-secondary" onClick={toggleInput}>
            {inputExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Input
          </button>
          {inputExpanded && (
            <div className="mt-0.5">
              <MonacoEditorField
                value={JSON.stringify(entry.input, null, 2)}
                language="json"
                readOnly
                fontSize={fontSize - 2}
                path={`debug-input-${entry.nodeId}-${entry.timestamp}`}
                testId={`debug-input-editor-${entry.nodeId}`}
                height="120px"
              />
            </div>
          )}
        </div>
      )}

      {entry.output !== undefined && entry.output !== null && (
        <div className="mt-1">
          <button className="flex items-center gap-1 text-[10px] text-app-muted hover:text-app-secondary" onClick={toggleOutput}>
            {outputExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Output
          </button>
          {outputExpanded && (
            <div className="mt-0.5">
              <MonacoEditorField
                value={JSON.stringify(entry.output, null, 2)}
                language="json"
                readOnly
                fontSize={fontSize - 2}
                path={`debug-output-${entry.nodeId}-${entry.timestamp}`}
                testId={`debug-output-editor-${entry.nodeId}`}
                height="240px"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

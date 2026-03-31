import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Send, Code, Braces, Timer } from 'lucide-react';
import type { ExecutionLogEntry, StitchNodeType } from '@/types/stitch';

const NODE_ICONS: Record<StitchNodeType, React.ReactNode> = {
  'request': <Send size={11} />,
  'js-snippet': <Code size={11} />,
  'json-object': <Braces size={11} />,
  'sleep': <Timer size={11} />,
};

const STATUS_COLORS: Record<string, string> = {
  started: 'text-blue-400',
  completed: 'text-green-400',
  error: 'text-red-400',
  sleeping: 'text-purple-400',
  cancelled: 'text-yellow-400',
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

  const toggleInput = useCallback((): void => setInputExpanded((p) => !p), []);
  const toggleOutput = useCallback((): void => setOutputExpanded((p) => !p), []);

  return (
    <div
      className={`border-b border-app-subtle px-3 py-1.5 ${isError ? 'bg-red-500/10' : ''}`}
      data-testid={`debug-log-entry-${entry.nodeId}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-app-muted">{formatTimestamp(entry.timestamp)}</span>
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

      {entry.input && Object.keys(entry.input).length > 0 && (
        <div className="mt-1">
          <button className="flex items-center gap-1 text-[10px] text-app-muted hover:text-app-secondary" onClick={toggleInput}>
            {inputExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Input
          </button>
          {inputExpanded && (
            <pre className="mt-0.5 max-h-[120px] overflow-auto rounded bg-app-sidebar p-2 text-[10px] text-app-secondary">
              {JSON.stringify(entry.input, null, 2)}
            </pre>
          )}
        </div>
      )}

      {entry.output && Object.keys(entry.output).length > 0 && (
        <div className="mt-1">
          <button className="flex items-center gap-1 text-[10px] text-app-muted hover:text-app-secondary" onClick={toggleOutput}>
            {outputExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Output
          </button>
          {outputExpanded && (
            <pre className="mt-0.5 max-h-[120px] overflow-auto rounded bg-app-sidebar p-2 text-[10px] text-app-secondary">
              {JSON.stringify(entry.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

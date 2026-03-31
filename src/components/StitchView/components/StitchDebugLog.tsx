import { useEffect, useRef } from 'react';
import { X, ScrollText } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { StitchDebugLogEntry } from './StitchDebugLogEntry';

interface StitchDebugLogProps {
  onClose: () => void;
}

export function StitchDebugLog({ onClose }: StitchDebugLogProps): React.ReactElement {
  const logs = useStitchStore((s) => s.executionLogs);
  const executionError = useStitchStore((s) => s.executionError);
  const executionState = useStitchStore((s) => s.executionState);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // Auto-scroll to bottom on new log entries
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || userScrolledRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  const handleScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    userScrolledRef.current = !atBottom;
  };

  // Scroll to error entry on error
  useEffect(() => {
    if (executionError && scrollRef.current) {
      userScrolledRef.current = false;
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [executionError]);

  const errorNodeId = executionError?.nodeId ?? null;

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="stitch-debug-log">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-app-subtle bg-app-sidebar px-3 py-1.5">
        <ScrollText size={12} className="text-app-secondary" />
        <span className="text-xs font-medium text-app-muted">Debug Log</span>
        <span className="text-xs text-app-subtle">—</span>
        <span className="min-w-0 flex-1 text-xs text-app-muted">
          {executionState === 'running'
            ? 'Running...'
            : executionState === 'error'
              ? 'Failed'
              : executionState === 'completed'
                ? `Completed (${logs.filter((l) => l.status === 'completed').length} nodes)`
                : 'Idle'}
        </span>
        <button
          className="rounded p-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-secondary"
          onClick={onClose}
          title="Close log"
          data-testid="debug-log-close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={handleScroll}
        data-testid="debug-log-entries"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-app-muted">Waiting for execution...</p>
          </div>
        ) : (
          logs.map((entry, i) => (
            <StitchDebugLogEntry
              key={`${entry.nodeId}-${entry.status}-${i}`}
              entry={entry}
              isError={entry.nodeId === errorNodeId && entry.status === 'error'}
            />
          ))
        )}
      </div>
    </div>
  );
}

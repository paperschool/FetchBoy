import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, ScrollText, ChevronRight, ChevronDown, Repeat } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { StitchDebugLogEntry } from './StitchDebugLogEntry';
import type { ExecutionLogEntry } from '@/types/stitch';

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

  // Group logs: top-level entries + loop groups
  const groupedLogs = useMemo(() => {
    const groups: Array<
      | { type: 'entry'; entry: ExecutionLogEntry; index: number }
      | { type: 'loop'; loopNodeId: string; entries: Array<{ entry: ExecutionLogEntry; index: number }> }
    > = [];
    let currentLoop: { loopNodeId: string; entries: Array<{ entry: ExecutionLogEntry; index: number }> } | null = null;

    for (let i = 0; i < logs.length; i++) {
      const entry = logs[i];
      if (entry.loopNodeId) {
        if (!currentLoop || currentLoop.loopNodeId !== entry.loopNodeId) {
          currentLoop = { loopNodeId: entry.loopNodeId, entries: [] };
          groups.push({ type: 'loop', ...currentLoop });
        }
        currentLoop.entries.push({ entry, index: i });
      } else {
        currentLoop = null;
        groups.push({ type: 'entry', entry, index: i });
      }
    }
    return groups;
  }, [logs]);

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
                ? `Completed (${logs.filter((l) => l.status === 'completed' && !l.loopNodeId).length} nodes)`
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
          groupedLogs.map((group, gi) =>
            group.type === 'entry' ? (
              <StitchDebugLogEntry
                key={`entry-${group.index}`}
                entry={group.entry}
                isError={group.entry.nodeId === errorNodeId && group.entry.status === 'error'}
              />
            ) : (
              <LoopLogGroup
                key={`loop-${gi}`}
                loopNodeId={group.loopNodeId}
                entries={group.entries}
                errorNodeId={errorNodeId}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

// ─── Collapsible loop log group ─────────────────────────────────────────────

function LoopLogGroup({ loopNodeId, entries, errorNodeId }: {
  loopNodeId: string;
  entries: Array<{ entry: ExecutionLogEntry; index: number }>;
  errorNodeId: string | null;
}): React.ReactElement {
  const nodes = useStitchStore((s) => s.nodes);
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback((): void => setCollapsed((p) => !p), []);

  const loopNode = nodes.find((n) => n.id === loopNodeId);
  const loopLabel = loopNode?.label ?? 'Loop';
  const iterationCount = new Set(entries.map((e) => e.entry.loopIteration)).size;
  const hasError = entries.some((e) => e.entry.status === 'error');

  return (
    <div>
      {/* Loop group header — clickable to collapse */}
      <button
        className={`flex w-full cursor-pointer items-center gap-2 border-b border-app-subtle px-3 py-1.5 text-left transition-colors hover:bg-app-hover ${hasError ? 'bg-red-500/5' : 'bg-cyan-500/5'}`}
        onClick={toggle}
        data-testid={`loop-group-${loopNodeId}`}
      >
        {collapsed ? <ChevronRight size={12} className="shrink-0 text-app-muted" /> : <ChevronDown size={12} className="shrink-0 text-app-muted" />}
        <Repeat size={11} className="shrink-0 text-cyan-600 dark:text-cyan-400" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-app-primary">{loopLabel}</span>
        <span className="text-[10px] text-app-muted">{iterationCount} iteration{iterationCount !== 1 ? 's' : ''}</span>
        <span className="text-[10px] text-app-muted">{entries.length} steps</span>
      </button>

      {/* Child entries */}
      {!collapsed && entries.map((e) => (
        <StitchDebugLogEntry
          key={`loop-${e.index}`}
          entry={e.entry}
          isError={e.entry.nodeId === errorNodeId && e.entry.status === 'error'}
        />
      ))}
    </div>
  );
}

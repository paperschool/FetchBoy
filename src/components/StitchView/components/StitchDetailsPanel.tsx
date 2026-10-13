import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, ScrollText, FileOutput, ChevronRight, ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { RequestDetailView } from '@/components/InterceptView/RequestDetailView';
import { StitchDebugLogEntry } from './StitchDebugLogEntry';
import { NodeEditorBody, NODE_TYPE_ICONS, NODE_TYPE_LABELS } from './StitchEditorPanel';
import { adaptChainOutputToInterceptRequest } from '../utils/nodeOutputToInterceptRequest';
import { mergeExecutionLogEntries } from '../utils/mergeExecutionLogEntries';
import type { ExecutionLogEntry, StitchNode, StitchConnection } from '@/types/stitch';

/** Fetch-terminal chains (Fetch-tab runs) have no mapping-entry node to pull
 * method/url from, so walk backwards through connections to find the
 * upstream request node feeding the terminal and use its config instead. */
function findUpstreamRequestNode(
  startNodeId: string,
  nodes: StitchNode[],
  connections: StitchConnection[],
): StitchNode | undefined {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>([startNodeId]);
  const queue = [startNodeId];
  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    for (const conn of connections) {
      if (conn.targetNodeId !== currentId || visited.has(conn.sourceNodeId)) continue;
      visited.add(conn.sourceNodeId);
      const sourceNode = nodeById.get(conn.sourceNodeId);
      if (sourceNode?.type === 'request') return sourceNode;
      queue.push(conn.sourceNodeId);
    }
  }
  return undefined;
}

interface StitchDetailsPanelProps {
  onClose: () => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

type DetailsTab = 'node' | 'log' | 'output';

const STATIC_TABS: Array<{ id: 'log' | 'output'; label: string; icon: React.ReactNode }> = [
  { id: 'log', label: 'Debug Log', icon: <ScrollText size={12} /> },
  { id: 'output', label: 'Output', icon: <FileOutput size={12} /> },
];

export function StitchDetailsPanel({ onClose, minimized, onToggleMinimize }: StitchDetailsPanelProps): React.ReactElement {
  const logs = useStitchStore((s) => s.executionLogs);
  const executionError = useStitchStore((s) => s.executionError);
  const executionState = useStitchStore((s) => s.executionState);
  const debugScrollToNodeId = useStitchStore((s) => s.debugScrollToNodeId);
  const bottomPanel = useStitchStore((s) => s.bottomPanel);
  const nodes = useStitchStore((s) => s.nodes);
  const connections = useStitchStore((s) => s.connections);
  const executionNodeOutputs = useStitchStore((s) => s.executionNodeOutputs);
  const selectedNodeId = useStitchStore((s) => s.selectedNodeId);
  const selectNode = useStitchStore((s) => s.selectNode);
  const editorFontSize = useUiSettingsStore((s) => s.editorFontSize);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const [activeTab, setActiveTab] = useState<DetailsTab>(
    selectedNode ? 'node' : (bottomPanel === 'output' ? 'output' : 'log'),
  );

  // A newly selected node always jumps to the front and becomes active —
  // matches clicking a node "taking over" the details panel.
  useEffect(() => {
    if (selectedNodeId) setActiveTab('node');
  }, [selectedNodeId]);

  // The "Debug log" and "Chain output" toolbar buttons both open this same
  // panel — just defaulting to a different tab. Only applies when no node is
  // selected, so a node's tab isn't yanked out from under the user.
  useEffect(() => {
    if (!selectedNodeId) setActiveTab(bottomPanel === 'output' ? 'output' : 'log');
  }, [bottomPanel, selectedNodeId]);

  // Clicking empty canvas hides the Node tab — fall back to whichever static
  // tab applies instead of leaving activeTab pointing at a tab that no longer exists.
  useEffect(() => {
    if (!selectedNode && activeTab === 'node') {
      setActiveTab(bottomPanel === 'output' ? 'output' : 'log');
    }
  }, [selectedNode, activeTab, bottomPanel]);

  // A node's own close (X) button just deselects it — same as before the
  // panels were merged. With no node selected, close fully resets the panel.
  const handleClose = useCallback((): void => {
    if (selectedNode) selectNode(null);
    else onClose();
  }, [selectedNode, selectNode, onClose]);

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

  // Scroll to specific node entry when Eye button is clicked
  useEffect(() => {
    if (!debugScrollToNodeId || !scrollRef.current) return;
    // Find the element and scroll to it
    const target = scrollRef.current.querySelector(`[data-testid="debug-log-entry-${debugScrollToNodeId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash highlight
      target.classList.add('bg-blue-500/15');
      setTimeout(() => target.classList.remove('bg-blue-500/15'), 1500);
    }
    // Clear the scroll target
    useStitchStore.setState({ debugScrollToNodeId: null });
  }, [debugScrollToNodeId]);

  const errorNodeId = executionError?.nodeId ?? null;

  // Merge each node's "started" entry with its eventual terminal entry into
  // one row — halves the row count instead of showing started/completed as
  // two separate full-width rows for every single node.
  const mergedLogs = useMemo(() => mergeExecutionLogEntries(logs), [logs]);

  // Group logs: top-level entries + loop groups
  const groupedLogs = useMemo(() => {
    const groups: Array<
      | { type: 'entry'; entry: ExecutionLogEntry; index: number }
      | { type: 'loop'; loopNodeId: string; entries: Array<{ entry: ExecutionLogEntry; index: number }> }
    > = [];
    let currentLoop: { loopNodeId: string; entries: Array<{ entry: ExecutionLogEntry; index: number }> } | null = null;

    for (let i = 0; i < mergedLogs.length; i++) {
      const entry = mergedLogs[i];
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
  }, [mergedLogs]);

  // The chain's actual terminal is always a mapping-exit or fetch-terminal
  // node — using type here (not "no outgoing connection") avoids miscounting
  // unrelated disconnected/scratch nodes as additional false "terminals",
  // which was previously causing the raw-JSON fallback to show instead of
  // the rich response viewer even when there was a single real output.
  // With exactly one, reuse the Intercept response viewer — merging in the
  // mapping-entry node's output (if any) for the request-side fields (url,
  // method, request headers/body) the terminal node alone doesn't carry.
  // With zero or several terminal nodes, fall back to raw JSON since there's
  // no single response to show.
  const { terminalRequest, fallbackOutputJson } = useMemo(() => {
    if (Object.keys(executionNodeOutputs).length === 0) {
      return { terminalRequest: null, fallbackOutputJson: '' };
    }
    const terminalNodes = nodes.filter((n) => n.type === 'mapping-exit' || n.type === 'fetch-terminal');

    if (terminalNodes.length === 1) {
      const node = terminalNodes[0];
      const output = executionNodeOutputs[node.id];
      if (output === undefined) return { terminalRequest: null, fallbackOutputJson: '' };
      const entryNode = nodes.find((n) => n.type === 'mapping-entry');
      let entryOutput: unknown = entryNode ? executionNodeOutputs[entryNode.id] : undefined;
      if (!entryOutput) {
        const requestNode = findUpstreamRequestNode(node.id, nodes, connections);
        if (requestNode) {
          const config = requestNode.config as { method?: string; url?: string };
          entryOutput = { method: config.method, url: config.url };
        }
      }
      return { terminalRequest: adaptChainOutputToInterceptRequest(output, entryOutput, Date.now()), fallbackOutputJson: '' };
    }

    if (terminalNodes.length === 0) {
      return { terminalRequest: null, fallbackOutputJson: JSON.stringify(executionNodeOutputs, null, 2) };
    }

    // Multiple terminal nodes — no single "the" response, show all raw.
    const combined: Record<string, unknown> = {};
    for (const tn of terminalNodes) {
      const output = executionNodeOutputs[tn.id];
      if (output !== undefined) combined[tn.label ?? tn.type] = output;
    }
    return { terminalRequest: null, fallbackOutputJson: JSON.stringify(combined, null, 2) };
  }, [executionNodeOutputs, nodes, connections]);

  const tabs = selectedNode
    ? [{ id: 'node' as const, label: selectedNode.label ?? NODE_TYPE_LABELS[selectedNode.type], icon: NODE_TYPE_ICONS[selectedNode.type] }, ...STATIC_TABS]
    : STATIC_TABS;

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="stitch-details-panel">
      {/* Header — tabs live in the same bar as the status/minimize/close,
          always visible (even minimized) so the panel stays discoverable.
          Clicking anywhere on the bar itself expands/collapses it, not just the chevron. */}
      <div
        className="flex shrink-0 cursor-pointer items-center gap-1 border-b border-app-subtle bg-app-sidebar px-3 py-1.5"
        onClick={onToggleMinimize}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={(e) => {
              // While minimized, let the click bubble up to the bar's own
              // handler to expand it too — one click both opens the panel
              // and picks the tab, instead of requiring two. Once expanded,
              // stop it from bubbling so switching tabs never re-minimizes.
              if (!minimized) e.stopPropagation();
              setActiveTab(tab.id as DetailsTab);
            }}
            className={`flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-app-main text-app-primary'
                : 'text-app-muted hover:text-app-primary'
            }`}
            data-testid={`details-tab-${tab.id}`}
          >
            <span className={activeTab === tab.id ? 'text-app-secondary' : ''}>{tab.icon}</span>
            <span className="max-w-[8rem] truncate">{tab.label}</span>
          </button>
        ))}
        <span className="min-w-0 flex-1 truncate text-right text-xs text-app-muted">
          {executionState === 'running'
            ? 'Running...'
            : executionState === 'error'
              ? 'Failed'
              : executionState === 'completed'
                ? `Completed (${logs.filter((l) => l.status === 'completed' && !l.loopNodeId).length} nodes)`
                : 'Idle'}
        </span>
        <button
          className="shrink-0 rounded p-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-secondary"
          title={minimized ? 'Show panel' : 'Hide panel'}
          data-testid="panel-minimize-toggle"
        >
          {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          className="shrink-0 rounded p-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-secondary"
          onClick={(e) => { e.stopPropagation(); handleClose(); }}
          title={selectedNode ? 'Close editor' : 'Close log'}
          data-testid="details-panel-close"
        >
          <X size={14} />
        </button>
      </div>

      {!minimized && (
        <div className="flex min-h-0 flex-1 flex-col" data-testid="stitch-details-panel-viewer">
          {activeTab === 'node' && selectedNode && <NodeEditorBody node={selectedNode} />}

          {activeTab === 'log' && (
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
                      onOpenNode={selectNode}
                    />
                  ) : (
                    <LoopLogGroup
                      key={`loop-${gi}`}
                      loopNodeId={group.loopNodeId}
                      entries={group.entries}
                      errorNodeId={errorNodeId}
                      onOpenNode={selectNode}
                    />
                  ),
                )
              )}
            </div>
          )}

          {activeTab === 'output' && (
            terminalRequest ? (
              <RequestDetailView selectedRequest={terminalRequest} hideActions />
            ) : fallbackOutputJson ? (
              <MonacoEditorField
                value={fallbackOutputJson}
                language="json"
                readOnly
                fontSize={editorFontSize}
                path="stitch-chain-output"
                testId="chain-output-editor"
                height="100%"
              />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-app-muted">No results yet — run the chain to see output</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible loop log group ─────────────────────────────────────────────

function LoopLogGroup({ loopNodeId, entries, errorNodeId, onOpenNode }: {
  loopNodeId: string;
  entries: Array<{ entry: ExecutionLogEntry; index: number }>;
  errorNodeId: string | null;
  onOpenNode: (nodeId: string) => void;
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
          onOpenNode={onOpenNode}
        />
      ))}
    </div>
  );
}

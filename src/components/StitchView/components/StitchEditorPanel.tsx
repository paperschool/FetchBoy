import { useCallback } from 'react';
import { Send, Code, Braces, Timer, ScrollText, Repeat, GitMerge, GitBranch, Globe, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, CircleStop, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { JsonObjectEditor } from './JsonObjectEditor';
import { JsSnippetEditor } from './JsSnippetEditor';
import { RequestNodeEditor } from './RequestNodeEditor';
import { SleepNodeEditor } from './SleepNodeEditor';
import { LoopNodeEditor } from './LoopNodeEditor';
import { MergeNodeEditor } from './MergeNodeEditor';
import { ConditionNodeEditor } from './ConditionNodeEditor';
import { MappingNodeEditor } from './MappingNodeEditor';
import { MappingExitNodeEditor } from './MappingExitNodeEditor';
import { NodeOutputView } from './NodeOutputView';
import type { StitchNode, StitchNodeType } from '@/types/stitch';

const TYPE_ICONS: Record<StitchNodeType, React.ReactNode> = {
  'request': <Send size={12} />,
  'js-snippet': <Code size={12} />,
  'json-object': <Braces size={12} />,
  'sleep': <Timer size={12} />,
  'log': <ScrollText size={12} />,
  'loop': <Repeat size={12} />,
  'merge': <GitMerge size={12} />,
  'condition': <GitBranch size={12} />,
  'mapping': <Globe size={12} />,
  'mapping-entry': <ArrowDownToLine size={12} />,
  'mapping-response': <ArrowLeftRight size={12} />,
  'mapping-exit': <ArrowUpFromLine size={12} />,
  'fetch-terminal': <CircleStop size={12} />,
};

const TYPE_LABELS: Record<StitchNodeType, string> = {
  'request': 'Request',
  'js-snippet': 'JS Snippet',
  'json-object': 'JSON Object',
  'sleep': 'Sleep',
  'log': 'Log',
  'loop': 'Loop',
  'merge': 'Merge',
  'condition': 'Condition',
  'mapping': 'Mapping',
  'mapping-entry': 'Entry',
  'mapping-response': 'Response',
  'mapping-exit': 'Exit',
  'fetch-terminal': 'Fetch Terminal',
};

export { TYPE_ICONS as NODE_TYPE_ICONS, TYPE_LABELS as NODE_TYPE_LABELS };

/** Type-specific editor routing, with no header/chrome — reused standalone
 * (below) and inside the unified details panel's Node tab. */
export function NodeEditorBody({ node }: { node: StitchNode }): React.ReactElement {
  return (
    <div className="min-h-0 flex-1">
      {node.type === 'json-object' && <JsonObjectEditor node={node} />}
      {node.type === 'js-snippet' && <JsSnippetEditor node={node} />}
      {node.type === 'request' && <RequestNodeEditor node={node} />}
      {node.type === 'sleep' && <SleepNodeEditor node={node} />}
      {node.type === 'log' && <NodeOutputView node={node} />}
      {node.type === 'loop' && <LoopNodeEditor node={node} />}
      {node.type === 'merge' && <MergeNodeEditor node={node} />}
      {node.type === 'condition' && <ConditionNodeEditor node={node} />}
      {node.type === 'mapping' && <MappingNodeEditor node={node} />}
      {node.type === 'mapping-exit' && <MappingExitNodeEditor node={node} />}
      {/* Entry/Response have no config to edit — all their behavior comes
          from wiring, not static fields — so show last-run output instead. */}
      {(node.type === 'mapping-entry' || node.type === 'mapping-response') && <NodeOutputView node={node} />}
    </div>
  );
}

interface StitchEditorPanelProps {
  node: StitchNode;
  minimized: boolean;
  onToggleMinimize: () => void;
}

export function StitchEditorPanel({ node, minimized, onToggleMinimize }: StitchEditorPanelProps): React.ReactElement {
  const selectNode = useStitchStore((s) => s.selectNode);

  const handleClose = useCallback((): void => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-app-sidebar" data-testid="node-editor-panel">
      {/* Unified header — click anywhere on the bar to expand/collapse, not just the chevron */}
      <div
        className="flex shrink-0 cursor-pointer items-center gap-2 border-b border-app-subtle bg-app-sidebar px-3 py-1.5"
        onClick={onToggleMinimize}
      >
        <span className="text-app-secondary">{TYPE_ICONS[node.type]}</span>
        <span className="text-xs font-medium text-app-muted">{TYPE_LABELS[node.type]}</span>
        <span className="text-xs text-app-subtle">—</span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-app-primary">
          {node.label ?? 'Untitled'}
        </span>
        <button
          className="rounded p-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-secondary"
          title={minimized ? 'Show panel' : 'Hide panel'}
          data-testid="panel-minimize-toggle"
        >
          {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          className="rounded p-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-secondary"
          onClick={(e) => { e.stopPropagation(); handleClose(); }}
          title="Close editor"
          data-testid="editor-close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Editor content */}
      {!minimized && <NodeEditorBody node={node} />}
    </div>
  );
}


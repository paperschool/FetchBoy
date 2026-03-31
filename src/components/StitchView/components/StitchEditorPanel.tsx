import { useCallback } from 'react';
import { Send, Code, Braces, Timer, Repeat, GitMerge, X } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { JsonObjectEditor } from './JsonObjectEditor';
import { JsSnippetEditor } from './JsSnippetEditor';
import { RequestNodeEditor } from './RequestNodeEditor';
import { SleepNodeEditor } from './SleepNodeEditor';
import { LoopNodeEditor } from './LoopNodeEditor';
import { MergeNodeEditor } from './MergeNodeEditor';
import type { StitchNode, StitchNodeType } from '@/types/stitch';

const TYPE_ICONS: Record<StitchNodeType, React.ReactNode> = {
  'request': <Send size={12} />,
  'js-snippet': <Code size={12} />,
  'json-object': <Braces size={12} />,
  'sleep': <Timer size={12} />,
  'loop': <Repeat size={12} />,
  'merge': <GitMerge size={12} />,
};

const TYPE_LABELS: Record<StitchNodeType, string> = {
  'request': 'Request',
  'js-snippet': 'JS Snippet',
  'json-object': 'JSON Object',
  'sleep': 'Sleep',
  'loop': 'Loop',
  'merge': 'Merge',
};

interface StitchEditorPanelProps {
  node: StitchNode;
}

export function StitchEditorPanel({ node }: StitchEditorPanelProps): React.ReactElement {
  const selectNode = useStitchStore((s) => s.selectNode);

  const handleClose = useCallback((): void => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="node-editor-panel">
      {/* Unified header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-app-subtle bg-app-sidebar px-3 py-1.5">
        <span className="text-app-secondary">{TYPE_ICONS[node.type]}</span>
        <span className="text-xs font-medium text-app-muted">{TYPE_LABELS[node.type]}</span>
        <span className="text-xs text-app-subtle">—</span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-app-primary">
          {node.label ?? 'Untitled'}
        </span>
        <button
          className="rounded p-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-secondary"
          onClick={handleClose}
          title="Close editor"
          data-testid="editor-close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Editor content */}
      <div className="min-h-0 flex-1">
        {node.type === 'json-object' && <JsonObjectEditor node={node} />}
        {node.type === 'js-snippet' && <JsSnippetEditor node={node} />}
        {node.type === 'request' && <RequestNodeEditor node={node} />}
        {node.type === 'sleep' && <SleepNodeEditor node={node} />}
        {node.type === 'loop' && <LoopNodeEditor node={node} />}
        {node.type === 'merge' && <MergeNodeEditor node={node} />}
      </div>
    </div>
  );
}

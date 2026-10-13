import { useCallback } from 'react';
import { Eye, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { NodeOutputView } from './NodeOutputView';

interface StitchPreviewPanelProps {
  minimized: boolean;
  onToggleMinimize: () => void;
}

export function StitchPreviewPanel({ minimized, onToggleMinimize }: StitchPreviewPanelProps): React.ReactElement | null {
  const previewNodeId = useStitchStore((s) => s.previewNodeId);
  const nodes = useStitchStore((s) => s.nodes);
  const executionLogs = useStitchStore((s) => s.executionLogs);
  const clearPreview = useStitchStore((s) => s.clearPreview);

  const node = nodes.find((n) => n.id === previewNodeId);

  const handleClose = useCallback((): void => {
    clearPreview();
  }, [clearPreview]);

  const lastLog = [...executionLogs].reverse().find(
    (e) => e.nodeId === previewNodeId && (e.status === 'completed' || e.status === 'replayed'),
  );
  const isReplayed = lastLog?.status === 'replayed';

  if (!previewNodeId || !node) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="preview-panel">
      {/* Header — always visible, even minimized, so the panel stays discoverable */}
      <div className="flex shrink-0 items-center gap-2 border-b border-app-subtle bg-app-sidebar px-3 py-1.5">
        <Eye size={12} className="text-app-secondary" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-app-primary">
          Preview: {node.label ?? node.type} — Last Run Output
        </span>
        {isReplayed && (
          <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">Replayed</span>
        )}
        <button
          className="rounded p-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-secondary"
          onClick={onToggleMinimize}
          title={minimized ? 'Show panel' : 'Hide panel'}
          data-testid="panel-minimize-toggle"
        >
          {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          className="rounded p-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-secondary"
          onClick={handleClose}
          title="Close preview"
          data-testid="preview-close"
        >
          <X size={14} />
        </button>
      </div>

      {!minimized && <NodeOutputView node={node} />}
    </div>
  );
}


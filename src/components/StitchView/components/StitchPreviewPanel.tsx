import { useCallback } from 'react';
import { Eye, X } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { formatNodeOutput } from '../utils/formatNodeOutput';

export function StitchPreviewPanel(): React.ReactElement | null {
  const previewNodeId = useStitchStore((s) => s.previewNodeId);
  const nodes = useStitchStore((s) => s.nodes);
  const executionNodeOutputs = useStitchStore((s) => s.executionNodeOutputs);
  const clearPreview = useStitchStore((s) => s.clearPreview);

  const node = nodes.find((n) => n.id === previewNodeId);

  const handleClose = useCallback((): void => {
    clearPreview();
  }, [clearPreview]);

  if (!previewNodeId || !node) return null;

  const executionLogs = useStitchStore((s) => s.executionLogs);
  const output = executionNodeOutputs[previewNodeId];
  const hasOutput = previewNodeId in executionNodeOutputs;
  const lastLog = [...executionLogs].reverse().find(
    (e) => e.nodeId === previewNodeId && (e.status === 'completed' || e.status === 'replayed'),
  );
  const isReplayed = lastLog?.status === 'replayed';

  if (!hasOutput) {
    return (
      <div className="flex h-full flex-col overflow-hidden" data-testid="preview-panel">
        <div className="flex shrink-0 items-center gap-2 border-b border-app-subtle bg-app-sidebar px-3 py-1.5">
          <Eye size={12} className="text-app-secondary" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-app-primary">
            Preview: {node.label ?? node.type} — Last Run Output
          </span>
          <button
            className="rounded p-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-secondary"
            onClick={handleClose}
            title="Close preview"
            data-testid="preview-close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-app-muted">No results yet — run the chain to see output</p>
        </div>
      </div>
    );
  }

  const formatted = formatNodeOutput(output);

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="preview-panel">
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
          onClick={handleClose}
          title="Close preview"
          data-testid="preview-close"
        >
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <MonacoEditorField
          value={formatted}
          language="json"
          readOnly={true}
          fontSize={12}
          path={`stitch-preview-${previewNodeId}`}
          testId="preview-monaco"
          height="100%"
        />
      </div>
    </div>
  );
}

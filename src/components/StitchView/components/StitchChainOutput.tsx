import { useMemo } from 'react';
import { FileOutput, X } from 'lucide-react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useStitchStore } from '@/stores/stitchStore';

interface StitchChainOutputProps {
  onClose: () => void;
}

export function StitchChainOutput({ onClose }: StitchChainOutputProps): React.ReactElement {
  const executionNodeOutputs = useStitchStore((s) => s.executionNodeOutputs);
  const executionState = useStitchStore((s) => s.executionState);
  const nodes = useStitchStore((s) => s.nodes);
  const connections = useStitchStore((s) => s.connections);
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);

  // Find the last node in the chain (no outgoing connections) and show its output
  const finalOutput = useMemo((): string => {
    if (Object.keys(executionNodeOutputs).length === 0) return '';
    const sourceNodeIds = new Set(connections.map((c) => c.sourceNodeId));
    const terminalNodes = nodes.filter((n) => !sourceNodeIds.has(n.id));
    if (terminalNodes.length === 0) return JSON.stringify(executionNodeOutputs, null, 2);

    if (terminalNodes.length === 1) {
      const output = executionNodeOutputs[terminalNodes[0].id];
      return output ? JSON.stringify(output, null, 2) : '';
    }

    // Multiple terminal nodes — show all
    const combined: Record<string, unknown> = {};
    for (const tn of terminalNodes) {
      const output = executionNodeOutputs[tn.id];
      if (output) combined[tn.label ?? tn.type] = output;
    }
    return JSON.stringify(combined, null, 2);
  }, [executionNodeOutputs, nodes, connections]);

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="stitch-chain-output">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-app-subtle bg-app-sidebar px-3 py-1.5">
        <FileOutput size={12} className="text-app-secondary" />
        <span className="text-xs font-medium text-app-muted">Chain Output</span>
        <span className="text-xs text-app-subtle">—</span>
        <span className="min-w-0 flex-1 text-xs text-app-muted">
          {executionState === 'completed'
            ? 'Final result'
            : executionState === 'error'
              ? 'Partial result'
              : executionState === 'running'
                ? 'Running...'
                : 'No results'}
        </span>
        <button
          className="rounded p-0.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-secondary"
          onClick={onClose}
          title="Close output"
          data-testid="chain-output-close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Output content */}
      <div className="min-h-0 flex-1">
        {finalOutput ? (
          <MonacoEditorField
            value={finalOutput}
            language="json"
            readOnly
            fontSize={fontSize}
            path="stitch-chain-output"
            testId="chain-output-editor"
            height="100%"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-app-muted">Run the chain to see output</p>
          </div>
        )}
      </div>
    </div>
  );
}

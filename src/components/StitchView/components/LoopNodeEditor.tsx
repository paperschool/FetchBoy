import { useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import type { StitchNode, LoopNodeConfig } from '@/types/stitch';

interface LoopNodeEditorProps {
  node: StitchNode;
}

export function LoopNodeEditor({ node }: LoopNodeEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);
  const nodes = useStitchStore((s) => s.nodes);
  const config = node.config as unknown as LoopNodeConfig;
  const delayMs = config.delayMs ?? 100;

  const childCount = nodes.filter((n) => n.parentNodeId === node.id).length;

  const handleDelayChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = Math.max(0, Math.min(10000, Number(e.target.value) || 0));
    updateNode(node.id, { config: { ...node.config, delayMs: val } }).catch(() => {});
  }, [node.id, node.config, updateNode]);

  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-app-primary">Loop Configuration</h3>
          <p className="mt-1 text-xs text-app-muted">
            Accepts an array as input and runs the sub-chain for each element.
            Each iteration receives <code className="rounded bg-app-sidebar px-1 py-0.5 text-[10px]">element</code> and <code className="rounded bg-app-sidebar px-1 py-0.5 text-[10px]">index</code> as inputs.
          </p>
        </div>

        <div>
          <label className="text-app-secondary mb-1 block text-xs font-medium">Delay Between Iterations (ms)</label>
          <input
            type="number"
            className="h-8 w-32 rounded-md border border-app-subtle bg-app-main px-2 text-sm text-app-primary"
            value={delayMs}
            onChange={handleDelayChange}
            min={0}
            max={10000}
            step={50}
            data-testid="loop-delay-input"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-app-muted">Sub-nodes:</span>
          <span className="text-xs font-medium text-app-primary">{childCount} / 5</span>
        </div>

        <div className="rounded bg-app-sidebar p-3 text-xs text-app-muted">
          <p className="font-medium text-app-secondary">How it works</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>Drag nodes into the loop frame to add them to the sub-chain</li>
            <li>Sub-nodes execute in topological order for each array element</li>
            <li>Errors in any iteration produce an empty object <code className="rounded bg-app-main px-1">{'{}'}</code></li>
            <li>Returns an array of results from the last sub-node</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

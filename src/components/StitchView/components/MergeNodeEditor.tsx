import { useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import type { StitchNode, MergeNodeConfig } from '@/types/stitch';

interface MergeNodeEditorProps {
  node: StitchNode;
}

export function MergeNodeEditor({ node }: MergeNodeEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);
  const config = node.config as unknown as MergeNodeConfig;
  const keyMode = config.keyMode ?? 'label';

  const handleToggle = useCallback(
    (mode: 'label' | 'id'): void => {
      updateNode(node.id, { config: { ...node.config, keyMode: mode } }).catch(() => {});
    },
    [node.id, node.config, updateNode],
  );

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="merge-node-editor">
      <div>
        <label className="mb-1 block text-xs font-medium text-app-muted">Output Key Naming</label>
        <div className="flex gap-2">
          <button
            className={`rounded px-3 py-1.5 text-xs ${keyMode === 'label' ? 'bg-indigo-500/20 text-indigo-400' : 'text-app-muted hover:bg-app-hover'}`}
            onClick={() => handleToggle('label')}
          >
            Node Label
          </button>
          <button
            className={`rounded px-3 py-1.5 text-xs ${keyMode === 'id' ? 'bg-indigo-500/20 text-indigo-400' : 'text-app-muted hover:bg-app-hover'}`}
            onClick={() => handleToggle('id')}
          >
            Node ID
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-app-muted">
          Keys in the merged output object are named using the {keyMode === 'label' ? 'label' : 'ID'} of each connected source node.
        </p>
      </div>
    </div>
  );
}

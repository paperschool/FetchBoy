import { useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import type { StitchNode, MappingNodeConfig } from '@/types/stitch';

const MATCH_TYPES = ['exact', 'partial', 'wildcard', 'regex'] as const;

interface MappingNodeEditorProps {
  node: StitchNode;
}

export function MappingNodeEditor({ node }: MappingNodeEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);
  const config = node.config as unknown as MappingNodeConfig;

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      updateNode(node.id, { config: { ...node.config, urlPattern: e.target.value } }).catch(() => {});
    },
    [node.id, node.config, updateNode],
  );

  const handleMatchType = useCallback(
    (matchType: string): void => {
      updateNode(node.id, { config: { ...node.config, matchType } }).catch(() => {});
    },
    [node.id, node.config, updateNode],
  );

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="mapping-node-editor">
      <div>
        <label className="mb-1 block text-xs font-medium text-app-muted">URL Pattern</label>
        <input
          className="w-full rounded border border-app-subtle bg-app-main px-2 py-1.5 text-xs text-app-primary outline-none focus:border-teal-500"
          value={config.urlPattern ?? ''}
          onChange={handleUrlChange}
          placeholder="e.g. /api/users/*"
          data-testid="mapping-url-input"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-app-muted">Match Type</label>
        <div className="flex gap-1">
          {MATCH_TYPES.map((mt) => (
            <button
              key={mt}
              className={`rounded px-2.5 py-1 text-[10px] font-medium ${
                (config.matchType ?? 'partial') === mt
                  ? 'bg-teal-500/20 text-teal-400'
                  : 'text-app-muted hover:bg-app-hover'
              }`}
              onClick={() => handleMatchType(mt)}
            >
              {mt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

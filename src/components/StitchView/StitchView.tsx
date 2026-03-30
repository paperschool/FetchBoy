import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { TabLayout } from '@/components/Layout/TabLayout';
import { useStitchStore } from '@/stores/stitchStore';
import { StitchCanvas } from './components/StitchCanvas';
import { JsonObjectEditor } from './components/JsonObjectEditor';

export function StitchView(): React.ReactElement {
  const [sidebarCollapsed] = useState(false);
  const chains = useStitchStore((s) => s.chains);
  const activeChainId = useStitchStore((s) => s.activeChainId);
  const selectedNodeId = useStitchStore((s) => s.selectedNodeId);
  const nodes = useStitchStore((s) => s.nodes);
  const loadChains = useStitchStore((s) => s.loadChains);
  const loadChain = useStitchStore((s) => s.loadChain);
  const createChain = useStitchStore((s) => s.createChain);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const showEditor = selectedNode?.type === 'json-object';

  useEffect(() => {
    loadChains().catch(() => {});
  }, [loadChains]);

  const handleSelectChain = useCallback(
    (chainId: string): void => {
      loadChain(chainId).catch(() => {});
    },
    [loadChain],
  );

  const handleCreateChain = useCallback((): void => {
    const name = `Chain ${chains.length + 1}`;
    createChain(name)
      .then((chain) => loadChain(chain.id))
      .catch(() => {});
  }, [chains.length, createChain, loadChain]);

  return (
    <TabLayout
      sidebarCollapsed={sidebarCollapsed}
      sidebar={
        <div className="flex h-full flex-col bg-app-sidebar p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-app-muted">
              Chains
            </h2>
            <button
              className="rounded p-0.5 text-green-500 hover:bg-app-hover"
              onClick={handleCreateChain}
              title="New chain"
              data-testid="new-chain-button"
            >
              <Plus size={14} />
            </button>
          </div>
          {chains.length === 0 ? (
            <p className="text-xs text-app-muted">No chains yet</p>
          ) : (
            <ul className="space-y-1">
              {chains.map((chain) => (
                <li
                  key={chain.id}
                  className={`cursor-pointer truncate rounded px-2 py-1 text-sm ${
                    chain.id === activeChainId
                      ? 'bg-blue-500/10 text-app-primary'
                      : 'text-app-secondary hover:bg-app-hover'
                  }`}
                  onClick={() => handleSelectChain(chain.id)}
                >
                  {chain.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      }
      mainContent={
        activeChainId ? (
          <div className="flex h-full flex-col">
            <div className={showEditor ? 'min-h-0 flex-1' : 'h-full'}>
              <StitchCanvas />
            </div>
            {showEditor && selectedNode && (
              <div className="h-[260px] shrink-0 border-t border-app-subtle" data-testid="node-editor-panel">
                <JsonObjectEditor node={selectedNode} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h1 className="text-lg font-semibold text-app-primary">
                Stitch — Request Chain Builder
              </h1>
              <p className="mt-1 text-sm text-app-muted">
                Select a chain or create one to get started
              </p>
            </div>
          </div>
        )
      }
    />
  );
}

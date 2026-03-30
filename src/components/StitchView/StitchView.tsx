import { useEffect, useState, useCallback } from 'react';
import { TabLayout } from '@/components/Layout/TabLayout';
import { useStitchStore } from '@/stores/stitchStore';
import { StitchCanvas } from './components/StitchCanvas';

export function StitchView(): React.ReactElement {
  const [sidebarCollapsed] = useState(false);
  const chains = useStitchStore((s) => s.chains);
  const activeChainId = useStitchStore((s) => s.activeChainId);
  const loadChains = useStitchStore((s) => s.loadChains);
  const loadChain = useStitchStore((s) => s.loadChain);

  useEffect(() => {
    loadChains().catch(() => {});
  }, [loadChains]);

  const handleSelectChain = useCallback(
    (chainId: string): void => {
      loadChain(chainId).catch(() => {});
    },
    [loadChain],
  );

  return (
    <TabLayout
      sidebarCollapsed={sidebarCollapsed}
      sidebar={
        <div className="flex h-full flex-col bg-app-sidebar p-3">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-app-muted">
            Chains
          </h2>
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
          <StitchCanvas />
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

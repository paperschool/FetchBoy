import { useState, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { StitchSidebarEntry } from './StitchSidebarEntry';

interface StitchSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function StitchSidebar({ collapsed, onToggleCollapse }: StitchSidebarProps): React.ReactElement {
  const chains = useStitchStore((s) => s.chains);
  const activeChainId = useStitchStore((s) => s.activeChainId);
  const loadChain = useStitchStore((s) => s.loadChain);
  const createChain = useStitchStore((s) => s.createChain);
  const renameChain = useStitchStore((s) => s.renameChain);
  const duplicateChain = useStitchStore((s) => s.duplicateChain);
  const deleteChain = useStitchStore((s) => s.deleteChain);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const sortedChains = [...chains].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const handleCreate = useCallback((): void => {
    const name = `Chain ${chains.length + 1}`;
    createChain(name)
      .then((chain) => loadChain(chain.id))
      .catch(() => {});
  }, [chains.length, createChain, loadChain]);

  const handleSelect = useCallback(
    (chainId: string): void => {
      if (chainId !== activeChainId) {
        loadChain(chainId).catch(() => {});
      }
    },
    [activeChainId, loadChain],
  );

  const handleRename = useCallback(
    (id: string, name: string): void => {
      renameChain(id, name).catch(() => {});
    },
    [renameChain],
  );

  const handleDuplicate = useCallback(
    (id: string): void => {
      duplicateChain(id).catch(() => {});
    },
    [duplicateChain],
  );

  const handleDeleteRequest = useCallback((id: string): void => {
    setDeleteConfirm(id);
  }, []);

  const handleDeleteConfirm = useCallback((): void => {
    if (!deleteConfirm) return;
    const chainId = deleteConfirm;
    setDeleteConfirm(null);
    deleteChain(chainId).then(() => {
      // If deleted chain was active and others exist, load the most recent
      const remaining = useStitchStore.getState().chains;
      if (remaining.length > 0 && useStitchStore.getState().activeChainId === null) {
        const sorted = [...remaining].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        loadChain(sorted[0].id).catch(() => {});
      }
    }).catch(() => {});
  }, [deleteConfirm, deleteChain, loadChain]);

  const deleteChainName = deleteConfirm ? chains.find((c) => c.id === deleteConfirm)?.name : '';

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-2 bg-app-sidebar p-2" data-testid="stitch-sidebar-collapsed">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded p-2 transition-colors hover:bg-gray-700"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <ChevronRight size={20} className="text-app-muted" />
        </button>
        <button
          className="rounded p-2 text-green-500 transition-colors hover:bg-gray-700"
          onClick={handleCreate}
          title="New chain"
          data-testid="new-chain-button"
        >
          <Plus size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-app-sidebar p-3" data-testid="stitch-sidebar">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded p-1.5 transition-colors hover:bg-gray-700"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <ChevronLeft size={18} className="text-app-muted" />
        </button>
        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Beta
        </span>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-app-muted">Chains</h2>
        <button
          className="rounded p-0.5 text-green-500 hover:bg-app-hover"
          onClick={handleCreate}
          title="New chain"
          data-testid="new-chain-button"
        >
          <Plus size={14} />
        </button>
      </div>

      {chains.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center" data-testid="empty-chains">
          <p className="text-xs text-app-muted">No chains yet</p>
          <button
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
            onClick={handleCreate}
            data-testid="create-first-chain"
          >
            Create Chain
          </button>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto" data-testid="chain-list">
          {sortedChains.map((chain) => (
            <StitchSidebarEntry
              key={chain.id}
              chain={chain}
              isActive={chain.id === activeChainId}
              onSelect={handleSelect}
              onRename={handleRename}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteRequest}
            />
          ))}
        </ul>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="delete-dialog">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-app-subtle bg-app-main p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-app-primary">Delete chain?</h3>
            <p className="mt-2 text-xs text-app-muted">
              Delete &ldquo;{deleteChainName}&rdquo;? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded px-3 py-1.5 text-xs text-app-secondary hover:bg-app-hover"
                onClick={() => setDeleteConfirm(null)}
                data-testid="delete-cancel"
              >
                Cancel
              </button>
              <button
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                onClick={handleDeleteConfirm}
                data-testid="delete-confirm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

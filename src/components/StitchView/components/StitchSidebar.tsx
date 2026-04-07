import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, FolderPlus } from 'lucide-react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useStitchStore } from '@/stores/stitchStore';
import { useStitchSidebarState } from '../hooks/useStitchSidebarState';
import { StitchFolderRow } from './StitchFolderRow';
import { StitchSidebarEntry } from './StitchSidebarEntry';
import { t } from '@/lib/i18n';

interface StitchSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function StitchSidebar({ collapsed, onToggleCollapse }: StitchSidebarProps): React.ReactElement {
  const {
    expanded, editingId, editingValue, editRef, tree, activeChainId,
    toggle, setEditingValue, startEdit, cancelEdit, commitEdit,
    handleCreateChain, handleDeleteChain, handleDuplicateChain,
    handleCreateFolder, handleDeleteFolder, handleMoveChainToFolder,
    handleSelectChain, handleDragEnd,
  } = useStitchSidebarState();

  const folders = useStitchStore((s) => s.folders);
  const chains = useStitchStore((s) => s.chains);
  const renameChain = useStitchStore((s) => s.renameChain);

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'chain' | 'folder'; id: string } | null>(null);
  const [dragging, setDragging] = useState<{ type: 'folder' | 'chain'; id: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (e: DragStartEvent): void => {
    const data = e.active.data.current as { type: string } | undefined;
    if (data?.type === 'folder' || data?.type === 'chain') {
      setDragging({ type: data.type as 'folder' | 'chain', id: String(e.active.id) });
    }
  };

  const confirmDelete = (): void => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    setDeleteConfirm(null);
    if (type === 'chain') void handleDeleteChain(id);
    else void handleDeleteFolder(id);
  };

  const deleteLabel = deleteConfirm?.type === 'chain'
    ? chains.find((c) => c.id === deleteConfirm.id)?.name ?? ''
    : folders.find((f) => f.id === deleteConfirm?.id)?.name ?? '';

  const rootFolderIds = tree.rootFolders.map((tf) => tf.folder.id);
  const rootChainIds = tree.rootChains.map((c) => c.id);

  const draggingChain = dragging?.type === 'chain' ? chains.find((c) => c.id === dragging.id) : null;
  const draggingFolder = dragging?.type === 'folder' ? folders.find((f) => f.id === dragging.id) : null;

  const handleEditChange = (v: string): void => setEditingValue(v);
  const handleCommitEdit = (): void => { void commitEdit(); };

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-2 bg-app-sidebar p-2" data-testid="stitch-sidebar-collapsed">
        <button type="button" onClick={onToggleCollapse} className="rounded p-2 transition-colors hover:bg-gray-700" aria-label="Expand sidebar" title="Expand sidebar">
          <ChevronRight size={20} className="text-app-muted" />
        </button>
        <button className="cursor-pointer rounded p-2 text-green-500 transition-colors hover:bg-gray-700" onClick={() => handleCreateChain().catch(() => {})} title="New chain" data-testid="new-chain-button">
          <Plus size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-app-sidebar p-3" data-testid="stitch-sidebar">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={onToggleCollapse} className="rounded p-1.5 transition-colors hover:bg-gray-700" aria-label="Collapse sidebar" title="Collapse sidebar">
          <ChevronLeft size={18} className="text-app-muted" />
        </button>
        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          {t('stitch.beta')}
        </span>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-app-muted">{t('stitch.chains')}</h2>
        <div className="flex items-center gap-1">
          <button type="button" className="cursor-pointer rounded p-0.5 text-app-muted hover:bg-app-hover hover:text-app-secondary" onClick={() => handleCreateFolder().catch(() => {})} title={t('stitch.newFolder')} data-testid="new-folder-button">
            <FolderPlus size={14} />
          </button>
          <button type="button" className="cursor-pointer rounded p-0.5 text-green-500 hover:bg-app-hover" onClick={() => handleCreateChain().catch(() => {})} title={t('stitch.newChain')} data-testid="new-chain-button">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {chains.length === 0 && folders.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center" data-testid="empty-chains">
          <p className="text-xs text-app-muted">{t('stitch.noChains')}</p>
          <button className="cursor-pointer rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500" onClick={() => handleCreateChain().catch(() => {})} data-testid="create-first-chain">
            {t('stitch.createChain')}
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={(e) => { setDragging(null); void handleDragEnd(e); }} onDragCancel={() => setDragging(null)}>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto" data-testid="chain-list">
            <SortableContext items={rootFolderIds} strategy={verticalListSortingStrategy}>
              {tree.rootFolders.map((tf) => (
                <StitchFolderRow
                  key={tf.folder.id}
                  treeFolder={tf}
                  isExpanded={Boolean(expanded[tf.folder.id])}
                  expanded={expanded}
                  editingId={editingId}
                  editingValue={editingValue}
                  editRef={editRef}
                  activeChainId={activeChainId}
                  folders={folders}
                  onToggle={toggle}
                  onEditChange={handleEditChange}
                  onStartEditFolder={(id, name) => startEdit('folder', id, name)}
                  onCommitEdit={handleCommitEdit}
                  onCancelEdit={cancelEdit}
                  onAddChain={(fid) => handleCreateChain(fid).catch(() => {})}
                  onAddSubfolder={(pid) => handleCreateFolder(pid).catch(() => {})}
                  onDeleteFolder={(id) => {
                    const f = folders.find((x) => x.id === id);
                    const hasChildren = chains.some((c) => c.folderId === id) || folders.some((x) => x.parentId === id);
                    if (hasChildren) setDeleteConfirm({ type: 'folder', id });
                    else if (f) void handleDeleteFolder(id);
                  }}
                  onSelectChain={handleSelectChain}
                  onRenameChain={(id, name) => void renameChain(id, name)}
                  onDuplicateChain={(id) => void handleDuplicateChain(id)}
                  onDeleteChain={(id) => setDeleteConfirm({ type: 'chain', id })}
                  onMoveChainToFolder={(cid, fid) => void handleMoveChainToFolder(cid, fid)}
                />
              ))}
            </SortableContext>
            <SortableContext items={rootChainIds} strategy={verticalListSortingStrategy}>
              {tree.rootChains.map((chain) => (
                <StitchSidebarEntry
                  key={chain.id}
                  chain={chain}
                  isActive={chain.id === activeChainId}
                  folders={folders}
                  onSelect={handleSelectChain}
                  onRename={(id, name) => void renameChain(id, name)}
                  onDuplicate={(id) => void handleDuplicateChain(id)}
                  onDelete={(id) => setDeleteConfirm({ type: 'chain', id })}
                  onMoveToFolder={(cid, fid) => void handleMoveChainToFolder(cid, fid)}
                />
              ))}
            </SortableContext>
          </ul>
          <DragOverlay dropAnimation={null}>
            {draggingFolder && (
              <div className="flex items-center gap-1 rounded border border-blue-400 bg-gray-600 px-2 py-0.5 text-sm text-app-inverse opacity-90 shadow-lg select-none">
                <ChevronRight size={14} className="shrink-0 text-app-muted" />
                <span className="truncate">{draggingFolder.name}</span>
              </div>
            )}
            {draggingChain && (
              <div className="flex items-center gap-1 rounded border border-blue-400 bg-gray-600 px-2 py-0.5 text-sm text-app-inverse opacity-90 shadow-lg select-none">
                <span className="truncate">{draggingChain.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="delete-dialog">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-app-subtle bg-app-main p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-app-primary">
              {deleteConfirm.type === 'chain' ? t('stitch.deleteChainTitle') : t('stitch.deleteFolderTitle')}
            </h3>
            <p className="mt-2 text-xs text-app-muted">
              {deleteConfirm.type === 'chain'
                ? t('stitch.deleteChainMessage', { name: deleteLabel })
                : t('stitch.deleteFolderMessage', { name: deleteLabel })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded px-3 py-1.5 text-xs text-app-secondary hover:bg-app-hover" onClick={() => setDeleteConfirm(null)} data-testid="delete-cancel">
                {t('common.cancel')}
              </button>
              <button className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500" onClick={confirmDelete} data-testid="delete-confirm">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

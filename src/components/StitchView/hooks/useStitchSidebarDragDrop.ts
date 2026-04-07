import { useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import { updateChainOrder, updateStitchFolderOrder } from '@/lib/stitchFolders';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';

interface UseStitchSidebarDragDropReturn {
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

export function useStitchSidebarDragDrop(): UseStitchSidebarDragDropReturn {
  const reorderFolders = useStitchStore((s) => s.reorderFolders);
  const reorderChains = useStitchStore((s) => s.reorderChains);
  const storeUpdateChainFolder = useStitchStore((s) => s.updateChainFolder);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeData = active.data.current as { type: 'folder' | 'chain'; folderId: string | null } | undefined;
    const overData = over.data.current as { type: 'folder' | 'chain' | 'root-drop'; folderId: string | null } | undefined;

    if (!activeData) return;

    // Chain dropped on root area
    if (overData?.type === 'root-drop' && activeData.type === 'chain') {
      if (activeData.folderId !== null) {
        await storeUpdateChainFolder(activeId, null);
      }
      return;
    }

    // Chain dropped on a folder → move into that folder
    if (activeData.type === 'chain' && overData?.type === 'folder') {
      await storeUpdateChainFolder(activeId, overId);
      return;
    }

    // Folder reordering
    if (activeData.type === 'folder' && overData?.type === 'folder') {
      const { folders } = useStitchStore.getState();
      const rootFolders = folders.filter((f) => f.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
      const ids = rootFolders.map((f) => f.id);
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(ids, oldIndex, newIndex);
      reorderFolders(newOrder);
      await Promise.all(newOrder.map((fid, idx) => updateStitchFolderOrder(fid, idx)));
      return;
    }

    // Chain reordering within same container
    if (activeData.type === 'chain' && overData?.type === 'chain') {
      const { chains } = useStitchStore.getState();
      const folderId = activeData.folderId;
      const containerChains = chains
        .filter((c) => c.folderId === folderId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const ids = containerChains.map((c) => c.id);
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(ids, oldIndex, newIndex);
      reorderChains(folderId, newOrder);
      await Promise.all(newOrder.map((cid, idx) => updateChainOrder(cid, idx)));
    }
  }, [reorderFolders, reorderChains, storeUpdateChainFolder]);

  return { handleDragEnd };
}

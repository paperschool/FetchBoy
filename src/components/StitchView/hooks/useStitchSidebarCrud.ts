import { useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import type { EditingType } from './useStitchInlineEdit';

interface UseStitchSidebarCrudReturn {
  handleCreateChain: (folderId?: string | null) => Promise<void>;
  handleDeleteChain: (id: string) => Promise<void>;
  handleDuplicateChain: (id: string) => Promise<void>;
  handleCreateFolder: (parentId?: string | null) => Promise<void>;
  handleDeleteFolder: (id: string) => Promise<void>;
  handleMoveChainToFolder: (chainId: string, folderId: string | null) => Promise<void>;
}

export function useStitchSidebarCrud(
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  startEdit: (type: EditingType, id: string, name: string) => void,
): UseStitchSidebarCrudReturn {
  const createChain = useStitchStore((s) => s.createChain);
  const deleteChain = useStitchStore((s) => s.deleteChain);
  const duplicateChain = useStitchStore((s) => s.duplicateChain);
  const loadChain = useStitchStore((s) => s.loadChain);
  const addFolder = useStitchStore((s) => s.addFolder);
  const deleteFolder = useStitchStore((s) => s.deleteFolder);
  const updateChainFolder = useStitchStore((s) => s.updateChainFolder);

  const handleCreateChain = useCallback(async (folderId?: string | null) => {
    try {
      const chains = useStitchStore.getState().chains;
      const name = `Chain ${chains.length + 1}`;
      const chain = await createChain(name, null, folderId);
      if (folderId) setExpanded((prev) => ({ ...prev, [folderId]: true }));
      await loadChain(chain.id);
    } catch (err) {
      console.error('[StitchSidebar] Failed to create chain:', err);
    }
  }, [createChain, loadChain, setExpanded]);

  const handleDeleteChain = useCallback(async (id: string) => {
    await deleteChain(id);
    const remaining = useStitchStore.getState().chains;
    if (remaining.length > 0 && useStitchStore.getState().activeChainId === null) {
      const sorted = [...remaining].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      await loadChain(sorted[0].id);
    }
  }, [deleteChain, loadChain]);

  const handleDuplicateChain = useCallback(async (id: string) => {
    await duplicateChain(id);
  }, [duplicateChain]);

  const handleCreateFolder = useCallback(async (parentId?: string | null) => {
    const folder = await addFolder('New Folder', parentId);
    if (parentId) setExpanded((prev) => ({ ...prev, [parentId]: true }));
    startEdit('folder', folder.id, folder.name);
  }, [addFolder, setExpanded, startEdit]);

  const handleDeleteFolder = useCallback(async (id: string) => {
    await deleteFolder(id);
  }, [deleteFolder]);

  const handleMoveChainToFolder = useCallback(async (chainId: string, folderId: string | null) => {
    await updateChainFolder(chainId, folderId);
    if (folderId) setExpanded((prev) => ({ ...prev, [folderId]: true }));
  }, [updateChainFolder, setExpanded]);

  return {
    handleCreateChain,
    handleDeleteChain,
    handleDuplicateChain,
    handleCreateFolder,
    handleDeleteFolder,
    handleMoveChainToFolder,
  };
}

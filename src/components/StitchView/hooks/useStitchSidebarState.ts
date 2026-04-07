import { useState, useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import type { StitchChain, StitchFolder } from '@/types/stitch';
import { useStitchInlineEdit, type EditingType } from './useStitchInlineEdit';
import { useStitchSidebarCrud } from './useStitchSidebarCrud';
import { useStitchSidebarDragDrop } from './useStitchSidebarDragDrop';
import type { DragEndEvent } from '@dnd-kit/core';

// ─── Tree Types ────────────────────────────────────────────────────────────

export interface TreeFolder {
  folder: StitchFolder;
  chains: StitchChain[];
  subfolders: TreeFolder[];
}

export interface StitchTree {
  rootFolders: TreeFolder[];
  rootChains: StitchChain[];
}

function buildTree(folders: StitchFolder[], chains: StitchChain[]): StitchTree {
  const folderMap = new Map<string, TreeFolder>();
  for (const f of folders) {
    folderMap.set(f.id, { folder: f, chains: [], subfolders: [] });
  }
  const rootFolders: TreeFolder[] = [];
  for (const f of [...folders].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const node = folderMap.get(f.id)!;
    if (f.parentId && folderMap.has(f.parentId)) {
      folderMap.get(f.parentId)!.subfolders.push(node);
    } else {
      rootFolders.push(node);
    }
  }
  const rootChains: StitchChain[] = [];
  for (const c of [...chains].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (c.folderId && folderMap.has(c.folderId)) {
      folderMap.get(c.folderId)!.chains.push(c);
    } else {
      rootChains.push(c);
    }
  }
  return { rootFolders, rootChains };
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export interface UseStitchSidebarStateReturn {
  expanded: Record<string, boolean>;
  editingId: string | null;
  editingType: EditingType | null;
  editingValue: string;
  editRef: React.MutableRefObject<HTMLInputElement | null>;
  tree: StitchTree;
  activeChainId: string | null;
  toggle: (id: string) => void;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setEditingValue: React.Dispatch<React.SetStateAction<string>>;
  startEdit: (type: EditingType, id: string, name: string) => void;
  cancelEdit: () => void;
  commitEdit: () => Promise<void>;
  handleCreateChain: (folderId?: string | null) => Promise<void>;
  handleDeleteChain: (id: string) => Promise<void>;
  handleDuplicateChain: (id: string) => Promise<void>;
  handleCreateFolder: (parentId?: string | null) => Promise<void>;
  handleDeleteFolder: (id: string) => Promise<void>;
  handleMoveChainToFolder: (chainId: string, folderId: string | null) => Promise<void>;
  handleSelectChain: (chainId: string) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

export function useStitchSidebarState(): UseStitchSidebarStateReturn {
  const chains = useStitchStore((s) => s.chains);
  const folders = useStitchStore((s) => s.folders);
  const activeChainId = useStitchStore((s) => s.activeChainId);
  const loadChain = useStitchStore((s) => s.loadChain);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const tree = buildTree(folders, chains);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSelectChain = useCallback((chainId: string) => {
    if (chainId !== activeChainId) {
      loadChain(chainId).catch(() => {});
    }
  }, [activeChainId, loadChain]);

  const inlineEdit = useStitchInlineEdit();
  const crud = useStitchSidebarCrud(setExpanded, inlineEdit.startEdit);
  const dragDrop = useStitchSidebarDragDrop();

  return {
    expanded,
    editingId: inlineEdit.editingId,
    editingType: inlineEdit.editingType,
    editingValue: inlineEdit.editingValue,
    editRef: inlineEdit.editRef,
    tree,
    activeChainId,
    toggle,
    setExpanded,
    setEditingValue: inlineEdit.setEditingValue,
    startEdit: inlineEdit.startEdit,
    cancelEdit: inlineEdit.cancelEdit,
    commitEdit: inlineEdit.commitEdit,
    handleSelectChain,
    ...crud,
    handleDragEnd: dragDrop.handleDragEnd,
  };
}

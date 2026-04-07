import { useCallback, useRef, useState } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import * as stitchFolderDb from '@/lib/stitchFolders';
import { useInlineRename } from '@/hooks/useInlineRename';

type EditingType = 'chain' | 'folder';

interface UseStitchInlineEditReturn {
  editingId: string | null;
  editingType: EditingType | null;
  editingValue: string;
  editRef: React.MutableRefObject<HTMLInputElement | null>;
  setEditingValue: React.Dispatch<React.SetStateAction<string>>;
  startEdit: (type: EditingType, id: string, name: string) => void;
  cancelEdit: () => void;
  commitEdit: () => Promise<void>;
}

export type { EditingType };

export function useStitchInlineEdit(): UseStitchInlineEditReturn {
  const renameChain = useStitchStore((s) => s.renameChain);
  const renameFolder = useStitchStore((s) => s.renameFolder);
  const [editingType, setEditingType] = useState<EditingType | null>(null);
  const editingTypeRef = useRef<EditingType | null>(null);

  const handleConfirm = useCallback((id: string, newName: string) => {
    const name = newName.trim();
    if (!name || !editingTypeRef.current) return;
    const type = editingTypeRef.current;
    editingTypeRef.current = null;
    setEditingType(null);
    if (type === 'chain') {
      void renameChain(id, name);
    } else {
      void stitchFolderDb.renameStitchFolder(id, name).then(() => renameFolder(id, name));
    }
  }, [renameChain, renameFolder]);

  const rename = useInlineRename(handleConfirm);

  const startEdit = useCallback((type: EditingType, id: string, name: string) => {
    editingTypeRef.current = type;
    setEditingType(type);
    rename.startEditing(id, name);
  }, [rename]);

  const cancelEdit = useCallback(() => {
    editingTypeRef.current = null;
    setEditingType(null);
    rename.cancelEditing();
  }, [rename]);

  const commitEdit = useCallback(async () => {
    if (rename.editingId && editingTypeRef.current) {
      const name = rename.editValue.trim();
      if (!name) { cancelEdit(); return; }
      const type = editingTypeRef.current;
      const id = rename.editingId;
      editingTypeRef.current = null;
      setEditingType(null);
      rename.cancelEditing();
      if (type === 'chain') {
        await renameChain(id, name);
      } else {
        await stitchFolderDb.renameStitchFolder(id, name);
        renameFolder(id, name);
      }
    }
  }, [rename, cancelEdit, renameChain, renameFolder]);

  return {
    editingId: rename.editingId,
    editingType,
    editingValue: rename.editValue,
    editRef: rename.editRef,
    setEditingValue: rename.setEditValue,
    startEdit,
    cancelEdit,
    commitEdit,
  };
}

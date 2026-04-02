import { useCallback, useRef, useState } from "react";
import { useCollectionStore } from "@/stores/collectionStore";
import {
  renameCollection as dbRenameCollection,
  renameFolder as dbRenameFolder,
  renameRequest as dbRenameRequest,
} from "@/lib/collections";
import { useInlineRename } from "@/hooks/useInlineRename";

type EditingType = "collection" | "folder" | "request";

interface UseCollectionInlineEditReturn {
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

export function useCollectionInlineEdit(): UseCollectionInlineEditReturn {
  const store = useCollectionStore();
  const [editingType, setEditingType] = useState<EditingType | null>(null);
  const editingTypeRef = useRef<EditingType | null>(null);

  const handleConfirm = useCallback((id: string, newName: string) => {
    const name = newName.trim();
    if (!name || !editingTypeRef.current) return;
    const type = editingTypeRef.current;
    editingTypeRef.current = null;
    setEditingType(null);
    if (type === "collection") {
      void dbRenameCollection(id, name).then(() => store.renameCollection(id, name));
    } else if (type === "folder") {
      void dbRenameFolder(id, name).then(() => store.renameFolder(id, name));
    } else {
      void dbRenameRequest(id, name).then(() => store.renameRequest(id, name));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

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
      if (type === "collection") {
        await dbRenameCollection(id, name);
        store.renameCollection(id, name);
      } else if (type === "folder") {
        await dbRenameFolder(id, name);
        store.renameFolder(id, name);
      } else {
        await dbRenameRequest(id, name);
        store.renameRequest(id, name);
      }
    }
  }, [rename, cancelEdit, store]);

  return {
    editingId: rename.editingId,
    editingType: editingType,
    editingValue: rename.editValue,
    editRef: rename.editRef,
    setEditingValue: rename.setEditValue,
    startEdit,
    cancelEdit,
    commitEdit,
  };
}

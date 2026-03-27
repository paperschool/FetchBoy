import { useCallback, useEffect, useRef, useState } from "react";
import { useCollectionStore } from "@/stores/collectionStore";
import {
  renameCollection as dbRenameCollection,
  renameFolder as dbRenameFolder,
  renameRequest as dbRenameRequest,
} from "@/lib/collections";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<EditingType | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const startEdit = useCallback(
    (type: EditingType, id: string, name: string) => {
      setEditingType(type);
      setEditingId(id);
      setEditingValue(name);
    },
    [],
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingType(null);
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editingId || !editingType || !editingValue.trim()) {
      cancelEdit();
      return;
    }
    const name = editingValue.trim();
    if (editingType === "collection") {
      await dbRenameCollection(editingId, name);
      store.renameCollection(editingId, name);
    } else if (editingType === "folder") {
      await dbRenameFolder(editingId, name);
      store.renameFolder(editingId, name);
    } else {
      await dbRenameRequest(editingId, name);
      store.renameRequest(editingId, name);
    }
    cancelEdit();
  }, [editingId, editingType, editingValue, cancelEdit, store]);

  return {
    editingId, editingType, editingValue, editRef,
    setEditingValue, startEdit, cancelEdit, commitEdit,
  };
}

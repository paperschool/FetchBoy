import { useEffect, useState } from "react";
import { useCollectionStore, type TreeCollection } from "@/stores/collectionStore";
import { loadAllCollections } from "@/lib/collections";
import { useCollectionInlineEdit, type EditingType } from "./useCollectionInlineEdit";
import { useCollectionCrud } from "./useCollectionCrud";
import { useCollectionDragDrop } from "./useCollectionDragDrop";
import type { DragEndEvent } from "@dnd-kit/core";

interface UseCollectionTreeStateReturn {
  expanded: Record<string, boolean>;
  editingId: string | null;
  editingType: EditingType | null;
  editingValue: string;
  editRef: React.MutableRefObject<HTMLInputElement | null>;
  tree: TreeCollection[];
  activeRequestId: string | null;

  toggle: (id: string) => void;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setEditingValue: React.Dispatch<React.SetStateAction<string>>;

  startEdit: (type: EditingType, id: string, name: string) => void;
  cancelEdit: () => void;
  commitEdit: () => Promise<void>;

  handleAddCollection: () => Promise<void>;
  handleDeleteCollection: (id: string) => Promise<void>;
  handleExportCollection: (id: string, name: string) => Promise<void>;
  handleImportCollection: () => Promise<void>;
  handleAddFolder: (colId: string) => Promise<void>;
  handleDeleteFolder: (id: string) => Promise<void>;
  handleLoadRequest: (id: string) => void;
  handleOpenInNewTab: (id: string) => void;
  handleAddRequest: (colId: string, folderId?: string | null) => Promise<void>;
  handleDeleteRequest: (id: string) => Promise<void>;
  handleUpdateRequest: (id: string) => Promise<void>;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

export function useCollectionTreeState(): UseCollectionTreeStateReturn {
  const store = useCollectionStore();
  const tree = store.getCollectionTree();
  const activeRequestId = store.activeRequestId;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Load collections from DB on mount
  useEffect(() => {
    loadAllCollections()
      .then(({ collections, folders, requests }) => {
        store.loadAll(collections, folders, requests);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string): void => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const inlineEdit = useCollectionInlineEdit();
  const crud = useCollectionCrud(setExpanded, inlineEdit.startEdit);
  const dragDrop = useCollectionDragDrop();

  return {
    expanded,
    editingId: inlineEdit.editingId,
    editingType: inlineEdit.editingType,
    editingValue: inlineEdit.editingValue,
    editRef: inlineEdit.editRef,
    tree,
    activeRequestId,

    toggle,
    setExpanded,
    setEditingValue: inlineEdit.setEditingValue,
    startEdit: inlineEdit.startEdit,
    cancelEdit: inlineEdit.cancelEdit,
    commitEdit: inlineEdit.commitEdit,

    ...crud,
    handleDragEnd: dragDrop.handleDragEnd,
  };
}

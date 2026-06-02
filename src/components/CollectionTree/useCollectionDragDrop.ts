import { useCallback } from "react";
import { useCollectionStore } from "@/stores/collectionStore";
import {
  moveRequestToFolder,
  updateFolderOrder,
  updateFolderParent,
  updateRequestOrder,
} from "@/lib/collections";
import { useToastStore } from "@/stores/toastStore";
import { t } from "@/lib/i18n";
import { canNestFolder } from "./folderDepth";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

interface UseCollectionDragDropReturn {
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

export function useCollectionDragDrop(): UseCollectionDragDropReturn {
  const store = useCollectionStore();

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      const activeData = active.data.current as
        | { type: string; colId: string; folderId: string | null }
        | undefined;
      const overData = over.data.current as
        | { type: string; colId: string; folderId: string | null }
        | undefined;

      if (!activeData) return;

      if (overData?.type === "collection-root") {
        if (activeData.type !== "request" || activeData.folderId === null) return;
        const colId = overData.colId as string;
        store.updateRequest(activeId, { folder_id: null });
        await moveRequestToFolder(activeId, colId, null);
        const freshRequests = useCollectionStore.getState().requests;
        const newOrder = freshRequests
          .filter((r) => r.collection_id === colId && r.folder_id === null)
          .map((r) => r.id);
        store.reorderRequests(colId, null, newOrder);
        await Promise.all(newOrder.map((rid, idx) => updateRequestOrder(rid, idx)));
        return;
      }

      if (activeData.type === "folder") {
        if (overData?.type !== "folder") return;
        const colId = activeData.colId;
        const dragged = store.folders.find((f) => f.id === activeId);
        const target = store.folders.find((f) => f.id === overId);
        if (!dragged || !target) return;

        if (dragged.parent_id === target.parent_id) {
          // Same parent group → reorder within siblings (depth unchanged).
          const siblings = store.folders
            .filter((f) => f.collection_id === colId && f.parent_id === dragged.parent_id)
            .sort((a, b) => a.sort_order - b.sort_order);
          const ids = siblings.map((f) => f.id);
          const oldIndex = ids.indexOf(activeId);
          const newIndex = ids.indexOf(overId);
          if (oldIndex === -1 || newIndex === -1) return;
          const newOrder = arrayMove(ids, oldIndex, newIndex);
          store.reorderFolders(colId, newOrder);
          await Promise.all(newOrder.map((fid, idx) => updateFolderOrder(fid, idx)));
        } else {
          // Different group → nest dragged INTO target, guarded by the 5-level cap.
          if (!canNestFolder(activeId, overId, store.folders)) {
            useToastStore.getState().addToast('warning', t('collections.maxDepthReached'));
            return;
          }
          store.moveFolder(activeId, overId);
          await updateFolderParent(activeId, overId);
          // Re-sequence the destination sibling group: keep the existing children in
          // their saved sort_order and place the dropped folder last (its old
          // sort_order is meaningless in the new group).
          const newSiblings = useCollectionStore
            .getState()
            .folders.filter(
              (f) => f.collection_id === colId && f.parent_id === overId && f.id !== activeId,
            )
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((f) => f.id);
          newSiblings.push(activeId);
          store.reorderFolders(colId, newSiblings);
          await Promise.all(newSiblings.map((fid, idx) => updateFolderOrder(fid, idx)));
        }
      } else if (activeData.type === "request") {
        const colId = activeData.colId;
        const activeFolderId = activeData.folderId;

        if (overData?.type === "folder") {
          const targetFolderId = overId;
          if (activeFolderId === targetFolderId) return;
          store.updateRequest(activeId, { folder_id: targetFolderId });
          await moveRequestToFolder(activeId, colId, targetFolderId);
          const freshRequests = useCollectionStore.getState().requests;
          const newOrder = freshRequests
            .filter((r) => r.collection_id === colId && r.folder_id === targetFolderId)
            .map((r) => r.id);
          store.reorderRequests(colId, targetFolderId, newOrder);
          await Promise.all(newOrder.map((rid, idx) => updateRequestOrder(rid, idx)));
        } else if (overData?.type === "request") {
          const overFolderId = overData.folderId;

          if (activeFolderId === overFolderId) {
            const containerRequests = store.requests
              .filter((r) => r.collection_id === colId && r.folder_id === activeFolderId)
              .sort((a, b) => a.sort_order - b.sort_order);
            const ids = containerRequests.map((r) => r.id);
            const oldIndex = ids.indexOf(activeId);
            const newIndex = ids.indexOf(overId);
            if (oldIndex === -1 || newIndex === -1) return;
            const newOrder = arrayMove(ids, oldIndex, newIndex);
            store.reorderRequests(colId, activeFolderId, newOrder);
            await Promise.all(newOrder.map((rid, idx) => updateRequestOrder(rid, idx)));
          } else {
            store.updateRequest(activeId, { folder_id: overFolderId });
            await moveRequestToFolder(activeId, colId, overFolderId);
            const freshRequests = useCollectionStore.getState().requests;
            const newOrder = freshRequests
              .filter((r) => r.collection_id === colId && r.folder_id === overFolderId)
              .map((r) => r.id);
            store.reorderRequests(colId, overFolderId, newOrder);
            await Promise.all(newOrder.map((rid, idx) => updateRequestOrder(rid, idx)));
          }
        }
      }
    },
    [store],
  );

  return { handleDragEnd };
}

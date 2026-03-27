import { useCallback } from "react";
import { useCollectionStore } from "@/stores/collectionStore";
import { moveRequestToFolder, updateFolderOrder, updateRequestOrder } from "@/lib/collections";
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
        const colFolders = store.folders
          .filter((f) => f.collection_id === colId)
          .sort((a, b) => a.sort_order - b.sort_order);
        const ids = colFolders.map((f) => f.id);
        const oldIndex = ids.indexOf(activeId);
        const newIndex = ids.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;
        const newOrder = arrayMove(ids, oldIndex, newIndex);
        store.reorderFolders(colId, newOrder);
        await Promise.all(newOrder.map((fid, idx) => updateFolderOrder(fid, idx)));
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

import { useEffect, useRef, useState, useCallback } from "react";
import {
  useCollectionStore,
  type TreeCollection,
} from "@/stores/collectionStore";
import { useTabStore } from "@/stores/tabStore";
import { buildSnapshotFromSaved } from "@/lib/requestSnapshotUtils";
import {
  createCollection,
  createFolder,
  createSavedRequest,
  deleteCollection as dbDeleteCollection,
  deleteFolder as dbDeleteFolder,
  deleteRequest as dbDeleteRequest,
  loadAllCollections,
  moveRequestToFolder,
  renameCollection as dbRenameCollection,
  renameFolder as dbRenameFolder,
  renameRequest as dbRenameRequest,
  updateFolderOrder,
  updateRequestOrder,
  updateSavedRequest,
} from "@/lib/collections";
import {
  exportCollectionToJson,
  importCollectionFromJson,
} from "@/lib/importExport";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

type EditingType = "collection" | "folder" | "request";

interface UseCollectionTreeStateReturn {
  // State
  expanded: Record<string, boolean>;
  editingId: string | null;
  editingType: EditingType | null;
  editingValue: string;
  editRef: React.MutableRefObject<HTMLInputElement | null>;
  tree: TreeCollection[];
  activeRequestId: string | null;

  // Actions
  toggle: (id: string) => void;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setEditingValue: React.Dispatch<React.SetStateAction<string>>;

  // Edit actions
  startEdit: (type: EditingType, id: string, name: string) => void;
  cancelEdit: () => void;
  commitEdit: () => Promise<void>;

  // Collection actions
  handleAddCollection: () => Promise<void>;
  handleDeleteCollection: (id: string) => Promise<void>;
  handleExportCollection: (id: string, name: string) => Promise<void>;
  handleImportCollection: () => Promise<void>;

  // Folder actions
  handleAddFolder: (colId: string) => Promise<void>;
  handleDeleteFolder: (id: string) => Promise<void>;

  // Request actions
  handleLoadRequest: (id: string) => void;
  handleOpenInNewTab: (id: string) => void;
  handleAddRequest: (colId: string, folderId?: string | null) => Promise<void>;
  handleDeleteRequest: (id: string) => Promise<void>;
  handleUpdateRequest: (id: string) => Promise<void>;

  // Drag & Drop
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

export function useCollectionTreeState(): UseCollectionTreeStateReturn {
  const store = useCollectionStore();
  const tree = store.getCollectionTree();
  const activeRequestId = store.activeRequestId;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<EditingType | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  // Load collections from DB on mount
  useEffect(() => {
    loadAllCollections()
      .then(({ collections, folders, requests }) => {
        store.loadAll(collections, folders, requests);
      })
      .catch(() => {
        // Silently swallow errors in test/non-Tauri environments
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

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

  const handleLoadRequest = useCallback(
    (id: string) => {
      const request = store.requests.find((r) => r.id === id);
      if (!request) return;
      const { activeTabId, tabs, updateTabRequestState } =
        useTabStore.getState();
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab?.requestState.isDirty) {
        if (
          !window.confirm(
            "You have unsaved changes. Discard and load this request?",
          )
        )
          return;
      }
      updateTabRequestState(activeTabId, buildSnapshotFromSaved(request));
      store.setActiveRequest(id);
    },
    [store],
  );

  const handleOpenInNewTab = useCallback(
    (id: string) => {
      const request = store.requests.find((r) => r.id === id);
      if (!request) return;
      const snapshot = buildSnapshotFromSaved(request);
      useTabStore.getState().openRequestInNewTab(snapshot, request.name);
    },
    [store],
  );

  const handleAddCollection = useCallback(async () => {
    const col = await createCollection("New Collection");
    store.addCollection(col);
    setExpanded((prev) => ({ ...prev, [col.id]: true }));
    startEdit("collection", col.id, col.name);
  }, [store, startEdit]);

  const handleDeleteCollection = useCallback(
    async (id: string) => {
      try {
        await dbDeleteCollection(id);
        store.deleteCollection(id);
      } catch (error) {
        console.error("Failed to delete collection", error);
      }
    },
    [store],
  );

  const handleAddFolder = useCallback(
    async (colId: string) => {
      const folder = await createFolder(colId, "New Folder");
      store.addFolder(folder);
      setExpanded((prev) => ({ ...prev, [folder.id]: true }));
      startEdit("folder", folder.id, folder.name);
    },
    [store, startEdit],
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      try {
        await dbDeleteFolder(id);
        store.deleteFolder(id);
      } catch (error) {
        console.error("Failed to delete folder", error);
      }
    },
    [store],
  );

  const handleAddRequest = useCallback(
    async (colId: string, folderId: string | null = null) => {
      const req = await createSavedRequest(colId, "New Request", folderId);
      store.addRequest(req);
      startEdit("request", req.id, req.name);
    },
    [store, startEdit],
  );

  const handleDeleteRequest = useCallback(
    async (id: string) => {
      try {
        await dbDeleteRequest(id);
        store.deleteRequest(id);
      } catch (error) {
        console.error("Failed to delete request", error);
      }
    },
    [store],
  );

  const handleUpdateRequest = useCallback(
    async (id: string) => {
      const req = store.requests.find((r) => r.id === id);
      if (!req) return;
      const { activeTabId, tabs, updateTabRequestState } =
        useTabStore.getState();
      const activeTabEntry = tabs.find((t) => t.id === activeTabId);
      const { method, url, headers, queryParams, body, auth } =
        activeTabEntry?.requestState ??
        useTabStore.getState().tabs[0].requestState;

      let auth_type: "none" | "bearer" | "basic" | "api-key" = "none";
      let auth_config: Record<string, string> = {};
      if (auth.type === "bearer") {
        auth_type = "bearer";
        auth_config = { token: auth.token };
      } else if (auth.type === "basic") {
        auth_type = "basic";
        auth_config = { username: auth.username, password: auth.password };
      } else if (auth.type === "api-key") {
        auth_type = "api-key";
        auth_config = { key: auth.key, value: auth.value, in: auth.in };
      }

      const changes = {
        method,
        url,
        headers,
        query_params: queryParams,
        body_type: body.mode as
          | "none"
          | "raw"
          | "json"
          | "form-data"
          | "urlencoded",
        body_content: body.raw,
        auth_type,
        auth_config,
      };

      try {
        await updateSavedRequest(id, { ...req, ...changes });
        store.updateRequest(id, changes);
        if (store.activeRequestId === id) {
          updateTabRequestState(activeTabId, { isDirty: false });
        }
      } catch (error) {
        console.error("Failed to update request", error);
      }
    },
    [store],
  );

  const handleExportCollection = useCallback(
    async (id: string, name: string) => {
      const currentStore = useCollectionStore.getState();
      try {
        const json = exportCollectionToJson(id, currentStore);
        const path = await save({
          defaultPath: `${name.replace(/[^a-z0-9]/gi, "_")}.fetchboy`,
          filters: [{ name: "Fetchboy Collection", extensions: ["fetchboy"] }],
        });
        if (path) await writeTextFile(path, json);
      } catch (err) {
        window.alert(
          `Export failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [],
  );

  const handleImportCollection = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Fetchboy Collection", extensions: ["fetchboy"] }],
      });
      if (!selected) return;
      const path = typeof selected === "string" ? selected : selected[0];
      const text = await readTextFile(path);
      const { collection, folders, requests } =
        await importCollectionFromJson(text);
      store.addCollection(collection);
      for (const f of folders) store.addFolder(f);
      for (const r of requests) store.addRequest(r);
      window.alert(
        `Imported '${collection.name}' — ${folders.length} folder(s), ${requests.length} request(s).`,
      );
    } catch (err) {
      window.alert(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [store]);

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

      // Dropped onto the collection root droppable zone (no direct requests to target)
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
          // Move request into a folder
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
            // Same container — reorder
            const containerRequests = store.requests
              .filter(
                (r) =>
                  r.collection_id === colId && r.folder_id === activeFolderId
              )
              .sort((a, b) => a.sort_order - b.sort_order);
            const ids = containerRequests.map((r) => r.id);
            const oldIndex = ids.indexOf(activeId);
            const newIndex = ids.indexOf(overId);
            if (oldIndex === -1 || newIndex === -1) return;
            const newOrder = arrayMove(ids, oldIndex, newIndex);
            store.reorderRequests(colId, activeFolderId, newOrder);
            await Promise.all(
              newOrder.map((rid, idx) => updateRequestOrder(rid, idx))
            );
          } else {
            // Different container — move to over item's container
            store.updateRequest(activeId, { folder_id: overFolderId });
            await moveRequestToFolder(activeId, colId, overFolderId);
            const freshRequests = useCollectionStore.getState().requests;
            const newOrder = freshRequests
              .filter((r) => r.collection_id === colId && r.folder_id === overFolderId)
              .map((r) => r.id);
            store.reorderRequests(colId, overFolderId, newOrder);
            await Promise.all(
              newOrder.map((rid, idx) => updateRequestOrder(rid, idx))
            );
          }
        }
      }
    },
    [store],
  );

  return {
    // State
    expanded,
    editingId,
    editingType,
    editingValue,
    editRef,
    tree,
    activeRequestId,

    // Actions
    toggle,
    setExpanded,
    setEditingValue,
    startEdit,
    cancelEdit,
    commitEdit,
    handleAddCollection,
    handleDeleteCollection,
    handleExportCollection,
    handleImportCollection,
    handleAddFolder,
    handleDeleteFolder,
    handleLoadRequest,
    handleOpenInNewTab,
    handleAddRequest,
    handleDeleteRequest,
    handleUpdateRequest,
    handleDragEnd,
  };
}

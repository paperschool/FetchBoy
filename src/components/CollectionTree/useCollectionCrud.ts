import { useCallback } from "react";
import { useCollectionStore } from "@/stores/collectionStore";
import { useTabStore } from "@/stores/tabStore";
import { buildSnapshotFromSaved } from "@/lib/requestSnapshotUtils";
import { authStateToConfig } from "@/lib/urlUtils";
import {
  createCollection,
  createFolder,
  createSavedRequest,
  deleteCollection as dbDeleteCollection,
  deleteFolder as dbDeleteFolder,
  deleteRequest as dbDeleteRequest,
  updateSavedRequest,
} from "@/lib/collections";
import {
  exportCollectionToJson,
  importCollectionFromJson,
} from "@/lib/importExport";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { useEnvironmentStore } from "@/stores/environmentStore";
import { setActiveEnvironment } from "@/lib/environments";
import type { EditingType } from "./useCollectionInlineEdit";

interface UseCollectionCrudReturn {
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
}

export function useCollectionCrud(
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  startEdit: (type: EditingType, id: string, name: string) => void,
): UseCollectionCrudReturn {
  const store = useCollectionStore();

  const handleLoadRequest = useCallback(
    (id: string) => {
      const request = store.requests.find((r) => r.id === id);
      if (!request) return;
      const { activeTabId, tabs, updateTabRequestState } = useTabStore.getState();
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab?.requestState.isDirty) {
        if (!window.confirm("You have unsaved changes. Discard and load this request?")) return;
      }
      updateTabRequestState(activeTabId, buildSnapshotFromSaved(request));
      store.setActiveRequest(id);

      // Auto-switch to the collection's default environment if one is set.
      const collection = store.collections.find((c) => c.id === request.collection_id);
      if (collection?.default_environment_id) {
        const envStore = useEnvironmentStore.getState();
        if (envStore.activeEnvironmentId !== collection.default_environment_id) {
          envStore.setActive(collection.default_environment_id);
          void setActiveEnvironment(collection.default_environment_id);
        }
      }
    },
    [store],
  );

  const handleOpenInNewTab = useCallback(
    (id: string) => {
      const request = store.requests.find((r) => r.id === id);
      if (!request) return;
      useTabStore.getState().openRequestInNewTab(buildSnapshotFromSaved(request), request.name);
    },
    [store],
  );

  const handleAddCollection = useCallback(async () => {
    const col = await createCollection("New Collection");
    store.addCollection(col);
    setExpanded((prev) => ({ ...prev, [col.id]: true }));
    startEdit("collection", col.id, col.name);
  }, [store, startEdit, setExpanded]);

  const handleDeleteCollection = useCallback(
    async (id: string) => {
      try { await dbDeleteCollection(id); store.deleteCollection(id); }
      catch (error) { console.error("Failed to delete collection", error); }
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
    [store, startEdit, setExpanded],
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      try { await dbDeleteFolder(id); store.deleteFolder(id); }
      catch (error) { console.error("Failed to delete folder", error); }
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
      try { await dbDeleteRequest(id); store.deleteRequest(id); }
      catch (error) { console.error("Failed to delete request", error); }
    },
    [store],
  );

  const handleUpdateRequest = useCallback(
    async (id: string) => {
      const req = store.requests.find((r) => r.id === id);
      if (!req) return;
      const { activeTabId, tabs, updateTabRequestState } = useTabStore.getState();
      const activeTabEntry = tabs.find((t) => t.id === activeTabId);
      const { method, url, headers, queryParams, body, auth, preRequestScript, preRequestScriptEnabled } =
        activeTabEntry?.requestState ?? useTabStore.getState().tabs[0].requestState;

      const changes = {
        method, url, headers,
        query_params: queryParams,
        body_type: body.mode as "none" | "raw" | "json" | "form-data" | "urlencoded",
        body_content: body.raw,
        auth_type: auth.type,
        auth_config: authStateToConfig(auth),
        pre_request_script: preRequestScript,
        pre_request_script_enabled: preRequestScriptEnabled,
      };

      try {
        await updateSavedRequest(id, { ...req, ...changes });
        store.updateRequest(id, changes);
        if (store.activeRequestId === id) {
          updateTabRequestState(activeTabId, { isDirty: false });
        }
      } catch (error) { console.error("Failed to update request", error); }
    },
    [store],
  );

  const handleExportCollection = useCallback(
    async (id: string, name: string) => {
      try {
        const json = exportCollectionToJson(id, useCollectionStore.getState());
        const path = await save({
          defaultPath: `${name.replace(/[^a-z0-9]/gi, "_")}.fetchboy`,
          filters: [{ name: "Fetchboy Collection", extensions: ["fetchboy"] }],
        });
        if (path) await writeTextFile(path, json);
      } catch (err) {
        window.alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
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
      const { collection, folders, requests } = await importCollectionFromJson(text);
      store.addCollection(collection);
      for (const f of folders) store.addFolder(f);
      for (const r of requests) store.addRequest(r);
      window.alert(`Imported '${collection.name}' — ${folders.length} folder(s), ${requests.length} request(s).`);
    } catch (err) {
      window.alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [store]);

  return {
    handleAddCollection, handleDeleteCollection, handleExportCollection, handleImportCollection,
    handleAddFolder, handleDeleteFolder,
    handleLoadRequest, handleOpenInNewTab, handleAddRequest, handleDeleteRequest, handleUpdateRequest,
  };
}

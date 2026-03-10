import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FilePlus, FolderPlus, Pencil, Plus, Save, Trash2, Upload } from 'lucide-react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import {
    createCollection,
    createFolder,
    createSavedRequest,
    deleteCollection as dbDeleteCollection,
    deleteFolder as dbDeleteFolder,
    deleteRequest as dbDeleteRequest,
    loadAllCollections,
    renameCollection as dbRenameCollection,
    renameFolder as dbRenameFolder,
    renameRequest as dbRenameRequest,
    updateFolderOrder,
    updateRequestOrder,
    updateSavedRequest,
} from '@/lib/collections';
import { exportCollectionToJson, importCollectionFromJson } from '@/lib/importExport';
import { useCollectionStore } from '@/stores/collectionStore';
import { useRequestStore } from '@/stores/requestStore';

type EditingType = 'collection' | 'folder' | 'request';

export function CollectionTree() {
    const store = useCollectionStore();
    const tree = store.getCollectionTree();
    const requestStore = useRequestStore();

    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingType, setEditingType] = useState<EditingType | null>(null);
    const [editingValue, setEditingValue] = useState('');
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

    const toggle = (id: string) =>
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const handleLoadRequest = (id: string) => {
        const request = store.requests.find((r) => r.id === id);
        if (!request) return;
        if (requestStore.isDirty) {
            if (!window.confirm('You have unsaved changes. Discard and load this request?')) return;
        }
        requestStore.loadFromSaved(request);
        store.setActiveRequest(id);
    };

    const startEdit = (type: EditingType, id: string, name: string) => {
        setEditingType(type);
        setEditingId(id);
        setEditingValue(name);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingType(null);
    };

    const commitEdit = async () => {
        if (!editingId || !editingType || !editingValue.trim()) {
            cancelEdit();
            return;
        }
        const name = editingValue.trim();
        if (editingType === 'collection') {
            await dbRenameCollection(editingId, name);
            store.renameCollection(editingId, name);
        } else if (editingType === 'folder') {
            await dbRenameFolder(editingId, name);
            store.renameFolder(editingId, name);
        } else {
            await dbRenameRequest(editingId, name);
            store.renameRequest(editingId, name);
        }
        cancelEdit();
    };

    const handleAddCollection = async () => {
        const col = await createCollection('New Collection');
        store.addCollection(col);
        setExpanded((prev) => ({ ...prev, [col.id]: true }));
        startEdit('collection', col.id, col.name);
    };

    const handleDeleteCollection = async (id: string) => {
        try {
            await dbDeleteCollection(id);
            store.deleteCollection(id);
        } catch (error) {
            console.error('Failed to delete collection', error);
        }
    };

    const handleAddFolder = async (colId: string) => {
        const folder = await createFolder(colId, 'New Folder');
        store.addFolder(folder);
        setExpanded((prev) => ({ ...prev, [folder.id]: true }));
        startEdit('folder', folder.id, folder.name);
    };

    const handleDeleteFolder = async (id: string) => {
        try {
            await dbDeleteFolder(id);
            store.deleteFolder(id);
        } catch (error) {
            console.error('Failed to delete folder', error);
        }
    };

    const handleAddRequest = async (colId: string, folderId: string | null = null) => {
        const req = await createSavedRequest(colId, 'New Request', folderId);
        store.addRequest(req);
        startEdit('request', req.id, req.name);
    };

    const handleDeleteRequest = async (id: string) => {
        try {
            await dbDeleteRequest(id);
            store.deleteRequest(id);
        } catch (error) {
            console.error('Failed to delete request', error);
        }
    };

    const handleUpdateRequest = async (id: string) => {
        const req = store.requests.find((r) => r.id === id);
        if (!req) return;
        const { method, url, headers, queryParams, body, auth } = useRequestStore.getState();

        let auth_type: 'none' | 'bearer' | 'basic' | 'api-key' = 'none';
        let auth_config: Record<string, string> = {};
        if (auth.type === 'bearer') {
            auth_type = 'bearer';
            auth_config = { token: auth.token };
        } else if (auth.type === 'basic') {
            auth_type = 'basic';
            auth_config = { username: auth.username, password: auth.password };
        } else if (auth.type === 'api-key') {
            auth_type = 'api-key';
            auth_config = { key: auth.key, value: auth.value, in: auth.in };
        }

        const changes = {
            method,
            url,
            headers,
            query_params: queryParams,
            body_type: body.mode as 'none' | 'raw' | 'json' | 'form-data' | 'urlencoded',
            body_content: body.raw,
            auth_type,
            auth_config,
        };

        try {
            await updateSavedRequest(id, { ...req, ...changes });
            store.updateRequest(id, changes);
            if (store.activeRequestId === id) {
                useRequestStore.getState().markDirty(false);
            }
        } catch (error) {
            console.error('Failed to update request', error);
        }
    };

    const handleExportCollection = async (id: string, name: string) => {
        const currentStore = useCollectionStore.getState();
        try {
            const json = exportCollectionToJson(id, currentStore);
            const path = await save({
                defaultPath: `${name.replace(/[^a-z0-9]/gi, '_')}.fetchboy`,
                filters: [{ name: 'Fetchboy Collection', extensions: ['fetchboy'] }],
            });
            if (path) await writeTextFile(path, json);
        } catch (err) {
            window.alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const handleImportCollection = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'Fetchboy Collection', extensions: ['fetchboy'] }],
            });
            if (!selected) return;
            const path = typeof selected === 'string' ? selected : selected[0];
            const text = await readTextFile(path);
            const { collection, folders, requests } = await importCollectionFromJson(text);
            store.addCollection(collection);
            for (const f of folders) store.addFolder(f);
            for (const r of requests) store.addRequest(r);
            window.alert(`Imported '${collection.name}' — ${folders.length} folder(s), ${requests.length} request(s).`);
        } catch (err) {
            window.alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const handleDrop = async (
        e: React.DragEvent,
        targetId: string,
        colId: string,
        folderId: string | null,
        siblingIds: string[],
    ) => {
        e.preventDefault();
        let data: { type: 'folder' | 'request'; id: string; colId: string; folderId: string | null };
        try {
            data = JSON.parse(e.dataTransfer.getData('text/plain')) as typeof data;
        } catch {
            return;
        }
        if (data.colId !== colId || data.id === targetId) return;
        const srcIdx = siblingIds.indexOf(data.id);
        const tgtIdx = siblingIds.indexOf(targetId);
        if (srcIdx === -1 || tgtIdx === -1) return;
        const newOrder = [...siblingIds];
        newOrder.splice(srcIdx, 1);
        newOrder.splice(tgtIdx, 0, data.id);
        if (data.type === 'folder') {
            store.reorderFolders(colId, newOrder);
            await Promise.all(newOrder.map((fid, idx) => updateFolderOrder(fid, idx)));
        } else {
            store.reorderRequests(colId, folderId, newOrder);
            await Promise.all(newOrder.map((rid, idx) => updateRequestOrder(rid, idx)));
        }
    };

    return (
        <div data-testid="collection-tree" className="text-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-app-muted text-xs font-semibold uppercase tracking-widest">
                    Collections
                </span>
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => void handleImportCollection()}
                        aria-label="Import collection"
                        title="Import collection"
                        className="text-gray-300 hover:text-white p-1 rounded cursor-pointer"
                    >
                        <Upload size={14} />
                    </button>
                    <button
                        onClick={handleAddCollection}
                        aria-label="Add Collection"
                        className="text-gray-300 hover:text-white p-1 rounded cursor-pointer"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Empty state */}
            {tree.length === 0 && (
                <div
                    data-testid="empty-state"
                    className="text-app-muted text-sm text-center py-6 px-2"
                >
                    <p>No collections yet.</p>
                    <button
                        onClick={handleAddCollection}
                        className="text-blue-300 hover:underline mt-1 text-sm cursor-pointer"
                    >
                        Create one
                    </button>
                </div>
            )}

            {/* Tree */}
            {tree.map((colNode) => {
                const { item: col, folders: colFolders, requests: colRequests } = colNode;
                const isColOpen = Boolean(expanded[col.id]);
                const folderIds = colFolders.map((f) => f.item.id);
                const directReqIds = colRequests.map((r) => r.item.id);

                return (
                    <div key={col.id} data-testid={`collection-${col.id}`}>
                        {/* Collection row */}
                        <div className="flex items-center gap-1 py-1 px-1 rounded group hover:bg-gray-700 cursor-grab active:cursor-grabbing select-none">
                            <button
                                onClick={() => toggle(col.id)}
                                className="flex-shrink-0 text-app-muted cursor-pointer"
                                aria-label={isColOpen ? 'Collapse collection' : 'Expand collection'}
                            >
                                {isColOpen ? (
                                    <ChevronDown size={14} />
                                ) : (
                                    <ChevronRight size={14} />
                                )}
                            </button>

                            {editingId === col.id ? (
                                <input
                                    ref={editRef}
                                    className="flex-1 bg-gray-700 text-app-inverse text-sm outline-none px-1 rounded"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onBlur={commitEdit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') void commitEdit();
                                        if (e.key === 'Escape') cancelEdit();
                                    }}
                                    aria-label="Rename collection"
                                />
                            ) : (
                                <span
                                    className="flex-1 text-app-inverse text-sm truncate"
                                    onDoubleClick={() => startEdit('collection', col.id, col.name)}
                                >
                                    {col.name}
                                </span>
                            )}

                            <div className="hidden group-hover:flex items-center gap-0.5 text-gray-300">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        void handleAddFolder(col.id);
                                    }}
                                    aria-label="Add folder to collection"
                                    title="New Folder"
                                    className="p-1 rounded hover:text-white cursor-pointer"
                                    draggable={false}
                                >
                                    <FolderPlus size={14} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        void handleAddRequest(col.id);
                                    }}
                                    aria-label="Add request to collection"
                                    title="New Request"
                                    className="p-1 rounded hover:text-white cursor-pointer"
                                    draggable={false}
                                >
                                    <FilePlus size={14} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        startEdit('collection', col.id, col.name);
                                    }}
                                    aria-label="Rename collection"
                                    title="Rename"
                                    className="p-1 rounded hover:text-white cursor-pointer"
                                    draggable={false}
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        void handleExportCollection(col.id, col.name);
                                    }}
                                    aria-label={`Export ${col.name}`}
                                    title="Export collection"
                                    className="p-1 rounded hover:text-white cursor-pointer"
                                    draggable={false}
                                >
                                    <Download size={12} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        void handleDeleteCollection(col.id);
                                    }}
                                    aria-label="Delete collection"
                                    title="Delete"
                                    className="p-1 rounded text-red-400 hover:text-red-300 cursor-pointer"
                                    draggable={false}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Collection children */}
                        {isColOpen && (
                            <div className="ml-3" data-testid={`collection-children-${col.id}`}>
                                {/* Folders */}
                                {colFolders.map((folderNode) => {
                                    const { item: fld, children: fldReqs } = folderNode;
                                    const isFldOpen = Boolean(expanded[fld.id]);
                                    const fldReqIds = fldReqs.map((r) => r.item.id);

                                    return (
                                        <div
                                            key={fld.id}
                                            data-testid={`folder-${fld.id}`}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.effectAllowed = 'move';
                                                e.dataTransfer.setData(
                                                    'text/plain',
                                                    JSON.stringify({
                                                        type: 'folder',
                                                        id: fld.id,
                                                        colId: col.id,
                                                        folderId: null,
                                                    }),
                                                );
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) =>
                                                void handleDrop(e, fld.id, col.id, null, folderIds)
                                            }
                                        >
                                            <div className="flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-grab active:cursor-grabbing select-none">
                                                <button
                                                    onClick={() => toggle(fld.id)}
                                                    className="flex-shrink-0 text-app-muted cursor-pointer"
                                                    aria-label={
                                                        isFldOpen
                                                            ? 'Collapse folder'
                                                            : 'Expand folder'
                                                    }
                                                >
                                                    {isFldOpen ? (
                                                        <ChevronDown size={14} />
                                                    ) : (
                                                        <ChevronRight size={14} />
                                                    )}
                                                </button>

                                                {editingId === fld.id ? (
                                                    <input
                                                        ref={editRef}
                                                        className="flex-1 bg-gray-700 text-app-inverse text-sm outline-none px-1 rounded"
                                                        value={editingValue}
                                                        onChange={(e) =>
                                                            setEditingValue(e.target.value)
                                                        }
                                                        onBlur={commitEdit}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter')
                                                                void commitEdit();
                                                            if (e.key === 'Escape') cancelEdit();
                                                        }}
                                                        aria-label="Rename folder"
                                                    />
                                                ) : (
                                                    <span
                                                        className="flex-1 text-app-inverse text-sm truncate"
                                                        onDoubleClick={() =>
                                                            startEdit('folder', fld.id, fld.name)
                                                        }
                                                    >
                                                        {fld.name}
                                                    </span>
                                                )}

                                                <div className="hidden group-hover:flex items-center gap-0.5 text-gray-300">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            void handleAddRequest(col.id, fld.id);
                                                        }}
                                                        aria-label="Add request to folder"
                                                        title="New Request"
                                                        className="p-1 rounded hover:text-white cursor-pointer"
                                                        draggable={false}
                                                    >
                                                        <FilePlus size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            startEdit('folder', fld.id, fld.name);
                                                        }}
                                                        aria-label="Rename folder"
                                                        title="Rename"
                                                        className="p-1 rounded hover:text-white cursor-pointer"
                                                        draggable={false}
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            void handleDeleteFolder(fld.id);
                                                        }}
                                                        aria-label="Delete folder"
                                                        title="Delete"
                                                        className="p-1 rounded text-red-400 hover:text-red-300 cursor-pointer"
                                                        draggable={false}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {isFldOpen && (
                                                <div className="ml-3">
                                                    {fldReqs.map((reqNode) => (
                                                        <RequestRow
                                                            key={reqNode.item.id}
                                                            id={reqNode.item.id}
                                                            name={reqNode.item.name}
                                                            method={reqNode.item.method}
                                                            colId={col.id}
                                                            folderId={fld.id}
                                                            siblingIds={fldReqIds}
                                                            isActive={
                                                                store.activeRequestId ===
                                                                reqNode.item.id
                                                            }
                                                            editingId={editingId}
                                                            editingValue={editingValue}
                                                            editRef={editRef}
                                                            onEditChange={setEditingValue}
                                                            onStartEdit={() =>
                                                                startEdit(
                                                                    'request',
                                                                    reqNode.item.id,
                                                                    reqNode.item.name,
                                                                )
                                                            }
                                                            onCommitEdit={() => void commitEdit()}
                                                            onCancelEdit={cancelEdit}
                                                            onSelect={() =>
                                                                handleLoadRequest(
                                                                    reqNode.item.id,
                                                                )
                                                            }
                                                            onDelete={() =>
                                                                void handleDeleteRequest(
                                                                    reqNode.item.id,
                                                                )
                                                            }
                                                            onUpdate={() =>
                                                                void handleUpdateRequest(
                                                                    reqNode.item.id,
                                                                )
                                                            }
                                                            onDrop={(e) =>
                                                                void handleDrop(
                                                                    e,
                                                                    reqNode.item.id,
                                                                    col.id,
                                                                    fld.id,
                                                                    fldReqIds,
                                                                )
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Direct collection requests (no folder) */}
                                {colRequests.map((reqNode) => (
                                    <RequestRow
                                        key={reqNode.item.id}
                                        id={reqNode.item.id}
                                        name={reqNode.item.name}
                                        method={reqNode.item.method}
                                        colId={col.id}
                                        folderId={null}
                                        siblingIds={directReqIds}
                                        isActive={store.activeRequestId === reqNode.item.id}
                                        editingId={editingId}
                                        editingValue={editingValue}
                                        editRef={editRef}
                                        onEditChange={setEditingValue}
                                        onStartEdit={() =>
                                            startEdit('request', reqNode.item.id, reqNode.item.name)
                                        }
                                        onCommitEdit={() => void commitEdit()}
                                        onCancelEdit={cancelEdit}
                                        onSelect={() =>
                                            handleLoadRequest(reqNode.item.id)
                                        }
                                        onDelete={() =>
                                            void handleDeleteRequest(reqNode.item.id)
                                        }
                                        onUpdate={() =>
                                            void handleUpdateRequest(reqNode.item.id)
                                        }
                                        onDrop={(e) =>
                                            void handleDrop(
                                                e,
                                                reqNode.item.id,
                                                col.id,
                                                null,
                                                directReqIds,
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── RequestRow ───────────────────────────────────────────────────────────────

interface RequestRowProps {
    id: string;
    name: string;
    method: string;
    colId: string;
    folderId: string | null;
    siblingIds: string[];
    isActive: boolean;
    editingId: string | null;
    editingValue: string;
    editRef: React.Ref<HTMLInputElement>;
    onEditChange: (v: string) => void;
    onStartEdit: () => void;
    onCommitEdit: () => void;
    onCancelEdit: () => void;
    onSelect: () => void;
    onDelete: () => void;
    onUpdate: () => void;
    onDrop: (e: React.DragEvent) => void;
}

function RequestRow({
    id,
    name,
    method,
    colId,
    folderId,
    isActive,
    editingId,
    editingValue,
    editRef,
    onEditChange,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onSelect,
    onDelete,
    onUpdate,
    onDrop,
}: RequestRowProps) {
    const isEditing = editingId === id;
    return (
        <div
            data-testid={`request-${id}`}
            data-active={isActive ? 'true' : 'false'}
            draggable
            className={`flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-grab active:cursor-grabbing select-none ${
                isActive ? 'bg-gray-600' : ''
            }`}
            onClick={onSelect}
            onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData(
                    'text/plain',
                    JSON.stringify({ type: 'request', id, colId, folderId }),
                );
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
        >
            <span className="text-xs font-mono text-blue-300 w-8 flex-shrink-0">{method}</span>

            {isEditing ? (
                <input
                    ref={editRef}
                    className="flex-1 bg-gray-700 text-app-inverse text-sm outline-none px-1 rounded"
                    value={editingValue}
                    onChange={(e) => onEditChange(e.target.value)}
                    onBlur={onCommitEdit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onCommitEdit();
                        if (e.key === 'Escape') onCancelEdit();
                    }}
                    aria-label="Rename request"
                />
            ) : (
                <span
                    className="flex-1 text-app-inverse text-sm truncate"
                    onDoubleClick={onStartEdit}
                >
                    {name}
                </span>
            )}

            <div className="hidden group-hover:flex items-center gap-0.5 text-gray-300">
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onUpdate();
                    }}
                    aria-label="Update request from builder"
                    title="Update with current builder config"
                    className="p-1 rounded hover:text-white cursor-pointer"
                    draggable={false}
                >
                    <Save size={14} />
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onStartEdit();
                    }}
                    aria-label="Rename request"
                    title="Rename"
                    className="p-1 rounded hover:text-white cursor-pointer"
                    draggable={false}
                >
                    <Pencil size={14} />
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete();
                    }}
                    aria-label="Delete request"
                    title="Delete"
                    className="p-1 rounded text-red-400 hover:text-red-300 cursor-pointer"
                    draggable={false}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

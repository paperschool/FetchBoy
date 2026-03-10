import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FilePlus, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
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
} from '@/lib/collections';
import { useCollectionStore } from '@/stores/collectionStore';

type EditingType = 'collection' | 'folder' | 'request';

export function CollectionTree() {
    const store = useCollectionStore();
    const tree = store.getCollectionTree();

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
        if (!window.confirm('Delete this collection and all its contents?')) return;
        await dbDeleteCollection(id);
        store.deleteCollection(id);
    };

    const handleAddFolder = async (colId: string) => {
        const folder = await createFolder(colId, 'New Folder');
        store.addFolder(folder);
        setExpanded((prev) => ({ ...prev, [folder.id]: true }));
        startEdit('folder', folder.id, folder.name);
    };

    const handleDeleteFolder = async (id: string) => {
        if (!window.confirm('Delete this folder and all its requests?')) return;
        await dbDeleteFolder(id);
        store.deleteFolder(id);
    };

    const handleAddRequest = async (colId: string, folderId: string | null = null) => {
        const req = await createSavedRequest(colId, 'New Request', folderId);
        store.addRequest(req);
        startEdit('request', req.id, req.name);
    };

    const handleDeleteRequest = async (id: string) => {
        if (!window.confirm('Delete this request?')) return;
        await dbDeleteRequest(id);
        store.deleteRequest(id);
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
                <span className="text-app-muted text-[10px] font-semibold uppercase tracking-widest">
                    Collections
                </span>
                <button
                    onClick={handleAddCollection}
                    aria-label="Add Collection"
                    className="text-app-muted hover:text-white p-0.5 rounded"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Empty state */}
            {tree.length === 0 && (
                <div
                    data-testid="empty-state"
                    className="text-app-muted text-xs text-center py-6 px-2"
                >
                    <p>No collections yet.</p>
                    <button
                        onClick={handleAddCollection}
                        className="text-blue-400 hover:underline mt-1 text-xs"
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
                        <div className="flex items-center gap-1 py-1 px-1 rounded group hover:bg-gray-700 cursor-pointer select-none">
                            <button
                                onClick={() => toggle(col.id)}
                                className="flex-shrink-0 text-app-muted"
                                aria-label={isColOpen ? 'Collapse collection' : 'Expand collection'}
                            >
                                {isColOpen ? (
                                    <ChevronDown size={12} />
                                ) : (
                                    <ChevronRight size={12} />
                                )}
                            </button>

                            {editingId === col.id ? (
                                <input
                                    ref={editRef}
                                    className="flex-1 bg-gray-700 text-white text-xs outline-none px-1 rounded"
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
                                    className="flex-1 text-app-secondary text-xs truncate"
                                    onDoubleClick={() => startEdit('collection', col.id, col.name)}
                                >
                                    {col.name}
                                </span>
                            )}

                            <div className="hidden group-hover:flex items-center gap-0.5 text-app-muted">
                                <button
                                    onClick={() => void handleAddFolder(col.id)}
                                    aria-label="Add folder to collection"
                                    title="New Folder"
                                >
                                    <FolderPlus size={11} />
                                </button>
                                <button
                                    onClick={() => void handleAddRequest(col.id)}
                                    aria-label="Add request to collection"
                                    title="New Request"
                                >
                                    <FilePlus size={11} />
                                </button>
                                <button
                                    onClick={() => startEdit('collection', col.id, col.name)}
                                    aria-label="Rename collection"
                                    title="Rename"
                                >
                                    <Pencil size={11} />
                                </button>
                                <button
                                    onClick={() => void handleDeleteCollection(col.id)}
                                    aria-label="Delete collection"
                                    title="Delete"
                                >
                                    <Trash2 size={11} />
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
                                            <div className="flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-pointer select-none">
                                                <button
                                                    onClick={() => toggle(fld.id)}
                                                    className="flex-shrink-0 text-app-muted"
                                                    aria-label={
                                                        isFldOpen
                                                            ? 'Collapse folder'
                                                            : 'Expand folder'
                                                    }
                                                >
                                                    {isFldOpen ? (
                                                        <ChevronDown size={12} />
                                                    ) : (
                                                        <ChevronRight size={12} />
                                                    )}
                                                </button>

                                                {editingId === fld.id ? (
                                                    <input
                                                        ref={editRef}
                                                        className="flex-1 bg-gray-700 text-white text-xs outline-none px-1 rounded"
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
                                                        className="flex-1 text-app-secondary text-xs truncate"
                                                        onDoubleClick={() =>
                                                            startEdit('folder', fld.id, fld.name)
                                                        }
                                                    >
                                                        {fld.name}
                                                    </span>
                                                )}

                                                <div className="hidden group-hover:flex items-center gap-0.5 text-app-muted">
                                                    <button
                                                        onClick={() =>
                                                            void handleAddRequest(col.id, fld.id)
                                                        }
                                                        aria-label="Add request to folder"
                                                        title="New Request"
                                                    >
                                                        <FilePlus size={11} />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            startEdit('folder', fld.id, fld.name)
                                                        }
                                                        aria-label="Rename folder"
                                                        title="Rename"
                                                    >
                                                        <Pencil size={11} />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            void handleDeleteFolder(fld.id)
                                                        }
                                                        aria-label="Delete folder"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={11} />
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
                                                                store.setActiveRequest(
                                                                    reqNode.item.id,
                                                                )
                                                            }
                                                            onDelete={() =>
                                                                void handleDeleteRequest(
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
                                            store.setActiveRequest(reqNode.item.id)
                                        }
                                        onDelete={() =>
                                            void handleDeleteRequest(reqNode.item.id)
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
    editRef: React.RefObject<HTMLInputElement | null>;
    onEditChange: (v: string) => void;
    onStartEdit: () => void;
    onCommitEdit: () => void;
    onCancelEdit: () => void;
    onSelect: () => void;
    onDelete: () => void;
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
    onDrop,
}: RequestRowProps) {
    const isEditing = editingId === id;
    return (
        <div
            data-testid={`request-${id}`}
            data-active={isActive ? 'true' : 'false'}
            draggable
            className={`flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-pointer select-none ${
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
            <span className="text-[10px] font-mono text-blue-400 w-8 flex-shrink-0">{method}</span>

            {isEditing ? (
                <input
                    ref={editRef}
                    className="flex-1 bg-gray-700 text-white text-xs outline-none px-1 rounded"
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
                    className="flex-1 text-app-secondary text-xs truncate"
                    onDoubleClick={onStartEdit}
                >
                    {name}
                </span>
            )}

            <div className="hidden group-hover:flex items-center gap-0.5 text-app-muted">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onStartEdit();
                    }}
                    aria-label="Rename request"
                    title="Rename"
                >
                    <Pencil size={11} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    aria-label="Delete request"
                    title="Delete"
                >
                    <Trash2 size={11} />
                </button>
            </div>
        </div>
    );
}

import { ChevronDown, ChevronRight, Download, FilePlus, FolderPlus, Trash2 } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { RequestRow } from './RequestRow';
import { FolderRow } from './FolderRow';

export interface CollectionRowProps {
    collection: {
        id: string;
        name: string;
    };
    folders: {
        item: {
            id: string;
            name: string;
        };
        children: {
            item: {
                id: string;
                name: string;
                method: string;
            };
        }[];
    }[];
    requests: {
        item: {
            id: string;
            name: string;
            method: string;
        };
    }[];
    isExpanded: boolean;
    expandedFolders: Record<string, boolean>;
    editingId: string | null;
    editingValue: string;
    editRef: React.RefObject<HTMLInputElement | null>;
    activeRequestId: string | null;
    // Collection callbacks
    onToggle: () => void;
    onEditChange: (v: string) => void;
    onStartEdit: (name: string) => void;
    onCommitEdit: () => void;
    onCancelEdit: () => void;
    onAddFolder: () => void;
    onAddRequest: () => void;
    onExport: () => void;
    onDeleteCollection: () => void;
    // Folder callbacks
    onToggleFolder: (folderId: string) => void;
    onEditFolder: (folderId: string, name: string) => void;
    onCommitEditFolder: () => void;
    onCancelEditFolder: () => void;
    onAddRequestToFolder: (folderId: string) => void;
    onDeleteFolder: (folderId: string) => void;
    // Request callbacks
    onSelectRequest: (id: string) => void;
    onDeleteRequest: (id: string) => void;
    onUpdateRequest: (id: string) => void;
    onOpenRequestInNewTab: (id: string) => void;
}

export function CollectionRow({
    collection,
    folders,
    requests,
    isExpanded,
    expandedFolders,
    editingId,
    editingValue,
    editRef,
    activeRequestId,
    onToggle,
    onEditChange,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onAddFolder,
    onAddRequest,
    onExport,
    onDeleteCollection,
    onToggleFolder,
    onEditFolder,
    onCommitEditFolder,
    onCancelEditFolder,
    onAddRequestToFolder,
    onDeleteFolder,
    onSelectRequest,
    onDeleteRequest,
    onUpdateRequest,
    onOpenRequestInNewTab,
}: CollectionRowProps) {
    const isEditing = editingId === collection.id;
    const folderIds = folders.map((f) => f.item.id);
    const directReqIds = requests.map((r) => r.item.id);

    const { setNodeRef: setRootDropRef, isOver: isOverRoot } = useDroppable({
        id: `collection-root-${collection.id}`,
        data: { type: 'collection-root', colId: collection.id },
    });

    return (
        <div key={collection.id} data-testid={`collection-${collection.id}`}>
            {/* Collection row */}
            <div className="flex items-center gap-1 py-1 px-1 rounded group hover:bg-gray-700 cursor-grab active:cursor-grabbing select-none">
                <button
                    onClick={onToggle}
                    className="flex-shrink-0 text-app-muted cursor-pointer"
                    aria-label={isExpanded ? 'Collapse collection' : 'Expand collection'}
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {isEditing ? (
                    <input
                        ref={editRef as React.RefObject<HTMLInputElement>}
                        className="flex-1 bg-gray-700 text-app-inverse text-sm outline-none px-1 rounded"
                        value={editingValue}
                        onChange={(e) => onEditChange(e.target.value)}
                        onBlur={onCommitEdit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onCommitEdit();
                            if (e.key === 'Escape') onCancelEdit();
                        }}
                        aria-label="Rename collection"
                    />
                ) : (
                    <span
                        className="flex-1 text-app-inverse text-sm truncate"
                        onDoubleClick={() => onStartEdit(collection.name)}
                    >
                        {collection.name}
                    </span>
                )}

                <div className="hidden group-hover:flex items-center gap-0.5 text-gray-300">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onAddFolder();
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
                            onAddRequest();
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
                            onExport();
                        }}
                        aria-label={`Export ${collection.name}`}
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
                            onDeleteCollection();
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
            {isExpanded && (
                <div className="ml-3" data-testid={`collection-children-${collection.id}`}>
                    {/* Direct collection requests (no folder) — shown first, below title */}
                    <div
                        ref={setRootDropRef}
                        className={`min-h-1 rounded transition-colors ${isOverRoot ? 'outline outline-1 outline-blue-400/50 bg-blue-400/5' : ''}`}
                    >
                        {isOverRoot && requests.length === 0 && (
                            <div className="text-xs text-blue-400/70 px-2 py-1 text-center pointer-events-none">
                                Drop here to remove from folder
                            </div>
                        )}
                        <SortableContext items={directReqIds} strategy={verticalListSortingStrategy}>
                            {requests.map((reqNode) => (
                                <RequestRow
                                    key={reqNode.item.id}
                                    id={reqNode.item.id}
                                    name={reqNode.item.name}
                                    method={reqNode.item.method}
                                    colId={collection.id}
                                    folderId={null}
                                    isActive={activeRequestId === reqNode.item.id}
                                    editingId={editingId}
                                    editingValue={editingValue}
                                    editRef={editRef as React.Ref<HTMLInputElement>}
                                    onEditChange={onEditChange}
                                    onStartEdit={() => onEditFolder(reqNode.item.id, reqNode.item.name)}
                                    onCommitEdit={onCommitEdit}
                                    onCancelEdit={onCancelEdit}
                                    onSelect={() => onSelectRequest(reqNode.item.id)}
                                    onDelete={() => onDeleteRequest(reqNode.item.id)}
                                    onUpdate={() => onUpdateRequest(reqNode.item.id)}
                                    onOpenInNewTab={() => onOpenRequestInNewTab(reqNode.item.id)}
                                />
                            ))}
                        </SortableContext>
                    </div>

                    {/* Folders */}
                    <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
                        {folders.map((folderNode) => {
                            const { item: fld, children: fldReqs } = folderNode;

                            return (
                                <FolderRow
                                    key={fld.id}
                                    folder={fld}
                                    folderRequests={fldReqs}
                                    colId={collection.id}
                                    isExpanded={Boolean(expandedFolders[fld.id])}
                                    editingId={editingId}
                                    editingValue={editingValue}
                                    editRef={editRef}
                                    activeRequestId={activeRequestId}
                                    onToggle={() => onToggleFolder(fld.id)}
                                    onEditChange={onEditChange}
                                    onEditFolder={onEditFolder}
                                    onCommitEdit={onCommitEditFolder}
                                    onCancelEdit={onCancelEditFolder}
                                    onAddRequest={() => onAddRequestToFolder(fld.id)}
                                    onDeleteFolder={() => onDeleteFolder(fld.id)}
                                    onSelectRequest={onSelectRequest}
                                    onDeleteRequest={onDeleteRequest}
                                    onUpdateRequest={onUpdateRequest}
                                    onOpenRequestInNewTab={onOpenRequestInNewTab}
                                />
                            );
                        })}
                    </SortableContext>
                </div>
            )}
        </div>
    );
}

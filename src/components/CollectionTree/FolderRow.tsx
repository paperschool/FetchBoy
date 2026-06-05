import { useState } from 'react';
import { ChevronDown, ChevronRight, FilePlus, FolderPlus, Trash2 } from 'lucide-react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndMonitor } from '@dnd-kit/core';
import { RequestRow } from './RequestRow';
import { t } from '@/lib/i18n';
import { MAX_FOLDER_DEPTH_INDEX } from './folderDepth';
import type { TreeFolder } from '@/stores/collectionStore';

// Per-nesting-level indentation step (px). Equivalent to the old static `ml-3`,
// but applied once per level so indentation grows with depth and stays legible.
const INDENT_STEP_PX = 12;

export interface FolderRowProps {
    node: TreeFolder;
    colId: string;
    expandedFolders: Record<string, boolean>;
    editingId: string | null;
    editingValue: string;
    editRef: React.MutableRefObject<HTMLInputElement | null>;
    activeRequestId: string | null;
    onToggleFolder: (id: string) => void;
    onEditChange: (v: string) => void;
    onEditFolder: (id: string, name: string) => void;
    onCommitEdit: () => void;
    onCancelEdit: () => void;
    onAddRequest: (folderId: string) => void;
    onAddSubFolder: (parentId: string) => void;
    onDeleteFolder: (folderId: string) => void;
    onSelectRequest: (id: string) => void;
    onDeleteRequest: (id: string) => void;
    onUpdateRequest: (id: string) => void;
    onOpenRequestInNewTab: (id: string) => void;
}

export function FolderRow({
    node,
    colId,
    expandedFolders,
    editingId,
    editingValue,
    editRef,
    activeRequestId,
    onToggleFolder,
    onEditChange,
    onEditFolder,
    onCommitEdit,
    onCancelEdit,
    onAddRequest,
    onAddSubFolder,
    onDeleteFolder,
    onSelectRequest,
    onDeleteRequest,
    onUpdateRequest,
    onOpenRequestInNewTab,
}: FolderRowProps) {
    const folder = node.item;
    const isExpanded = Boolean(expandedFolders[folder.id]);
    const isEditing = editingId === folder.id;
    const canNest = node.depth < MAX_FOLDER_DEPTH_INDEX;
    const fldReqIds = node.requests.map((r) => r.item.id);
    const subFolderIds = node.folders.map((f) => f.item.id);

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: folder.id,
        data: { type: 'folder', colId },
    });

    const [isOver, setIsOver] = useState(false);
    useDndMonitor({
        onDragOver(event) { setIsOver(!isDragging && String(event.over?.id) === folder.id); },
        onDragEnd() { setIsOver(false); },
        onDragCancel() { setIsOver(false); },
    });

    return (
        <>
        {isOver && <div className="h-0.5 bg-blue-400 rounded mx-1 pointer-events-none" />}
        <div
            ref={setNodeRef}
            data-testid={`folder-${folder.id}`}
            data-depth={node.depth}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0 : undefined,
            }}
        >
            <div
                className="flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-app-subtle cursor-pointer select-none"
                {...attributes}
                {...listeners}
            >
                <button
                    onClick={() => onToggleFolder(folder.id)}
                    className="flex-shrink-0 text-app-muted cursor-pointer"
                    aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {isEditing ? (
                    <input
                        ref={editRef}
                        className="flex-1 bg-app-subtle text-app-inverse text-sm outline-none px-1 rounded"
                        value={editingValue}
                        onChange={(e) => onEditChange(e.target.value)}
                        onBlur={onCommitEdit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onCommitEdit();
                            if (e.key === 'Escape') onCancelEdit();
                        }}
                        aria-label="Rename folder"
                    />
                ) : (
                    <span
                        className="flex-1 text-app-inverse text-sm truncate"
                        onDoubleClick={() => onEditFolder(folder.id, folder.name)}
                    >
                        {folder.name}
                    </span>
                )}

                <div className="hidden group-hover:flex items-center gap-0.5 text-app-muted">
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddRequest(folder.id); }}
                        aria-label="Add request to folder"
                        title="New Request"
                        className="p-1 rounded hover:text-app-primary cursor-pointer"
                        draggable={false}
                    >
                        <FilePlus size={14} />
                    </button>

                    {canNest && (
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddSubFolder(folder.id); }}
                            aria-label="Add subfolder"
                            title={t('collections.newSubfolderTitle')}
                            className="p-1 rounded hover:text-app-primary cursor-pointer"
                            draggable={false}
                        >
                            <FolderPlus size={14} />
                        </button>
                    )}

                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteFolder(folder.id); }}
                        aria-label="Delete folder"
                        title="Delete"
                        className="p-1 rounded text-red-400 hover:text-red-300 cursor-pointer"
                        draggable={false}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div style={{ paddingLeft: INDENT_STEP_PX }}>
                    <SortableContext items={fldReqIds} strategy={verticalListSortingStrategy}>
                        {node.requests.map((reqNode) => (
                            <RequestRow
                                key={reqNode.item.id}
                                id={reqNode.item.id}
                                name={reqNode.item.name}
                                method={reqNode.item.method}
                                colId={colId}
                                folderId={folder.id}
                                isActive={activeRequestId === reqNode.item.id}
                                editingId={editingId}
                                editingValue={editingValue}
                                editRef={editRef}
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

                    {/* Nested sub-folders (recursive) */}
                    <SortableContext items={subFolderIds} strategy={verticalListSortingStrategy}>
                        {node.folders.map((childNode) => (
                            <FolderRow
                                key={childNode.item.id}
                                node={childNode}
                                colId={colId}
                                expandedFolders={expandedFolders}
                                editingId={editingId}
                                editingValue={editingValue}
                                editRef={editRef}
                                activeRequestId={activeRequestId}
                                onToggleFolder={onToggleFolder}
                                onEditChange={onEditChange}
                                onEditFolder={onEditFolder}
                                onCommitEdit={onCommitEdit}
                                onCancelEdit={onCancelEdit}
                                onAddRequest={onAddRequest}
                                onAddSubFolder={onAddSubFolder}
                                onDeleteFolder={onDeleteFolder}
                                onSelectRequest={onSelectRequest}
                                onDeleteRequest={onDeleteRequest}
                                onUpdateRequest={onUpdateRequest}
                                onOpenRequestInNewTab={onOpenRequestInNewTab}
                            />
                        ))}
                    </SortableContext>
                </div>
            )}
        </div>
        </>
    );
}

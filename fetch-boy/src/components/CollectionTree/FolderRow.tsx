import { useState } from 'react';
import { ChevronDown, ChevronRight, FilePlus, Trash2 } from 'lucide-react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndMonitor } from '@dnd-kit/core';
import { RequestRow } from './RequestRow';

export interface FolderRowProps {
    folder: { id: string; name: string };
    folderRequests: { item: { id: string; name: string; method: string } }[];
    colId: string;
    isExpanded: boolean;
    editingId: string | null;
    editingValue: string;
    editRef: React.RefObject<HTMLInputElement | null>;
    activeRequestId: string | null;
    onToggle: () => void;
    onEditChange: (v: string) => void;
    onEditFolder: (id: string, name: string) => void;
    onCommitEdit: () => void;
    onCancelEdit: () => void;
    onAddRequest: () => void;
    onDeleteFolder: () => void;
    onSelectRequest: (id: string) => void;
    onDeleteRequest: (id: string) => void;
    onUpdateRequest: (id: string) => void;
    onOpenRequestInNewTab: (id: string) => void;
}

export function FolderRow({
    folder,
    folderRequests,
    colId,
    isExpanded,
    editingId,
    editingValue,
    editRef,
    activeRequestId,
    onToggle,
    onEditChange,
    onEditFolder,
    onCommitEdit,
    onCancelEdit,
    onAddRequest,
    onDeleteFolder,
    onSelectRequest,
    onDeleteRequest,
    onUpdateRequest,
    onOpenRequestInNewTab,
}: FolderRowProps) {
    const isEditing = editingId === folder.id;
    const fldReqIds = folderRequests.map((r) => r.item.id);

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
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0 : undefined,
            }}
        >
            <div
                className="flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-pointer select-none"
                {...attributes}
                {...listeners}
            >
                <button
                    onClick={onToggle}
                    className="flex-shrink-0 text-app-muted cursor-pointer"
                    aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

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

                <div className="hidden group-hover:flex items-center gap-0.5 text-gray-300">
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddRequest(); }}
                        aria-label="Add request to folder"
                        title="New Request"
                        className="p-1 rounded hover:text-white cursor-pointer"
                        draggable={false}
                    >
                        <FilePlus size={14} />
                    </button>

                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteFolder(); }}
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
                <div className="ml-3">
                    <SortableContext items={fldReqIds} strategy={verticalListSortingStrategy}>
                        {folderRequests.map((reqNode) => (
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
            )}
        </div>
        </>
    );
}

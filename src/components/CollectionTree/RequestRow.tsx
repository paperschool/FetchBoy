import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndMonitor } from '@dnd-kit/core';

export interface RequestRowProps {
    id: string;
    name: string;
    method: string;
    colId: string;
    folderId: string | null;
    isActive: boolean;
    editingId: string | null;
    editingValue: string;
    editRef: React.MutableRefObject<HTMLInputElement | null>;
    onEditChange: (v: string) => void;
    onStartEdit: () => void;
    onCommitEdit: () => void;
    onCancelEdit: () => void;
    onSelect: () => void;
    onDelete: () => void;
    onUpdate: () => void;
    onOpenInNewTab: () => void;
}

export function RequestRow({
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
    onOpenInNewTab,
}: RequestRowProps) {
    const isEditing = editingId === id;
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        data: { type: 'request', colId, folderId },
    });

    const [isOver, setIsOver] = useState(false);
    useDndMonitor({
        onDragOver(event) { setIsOver(!isDragging && String(event.over?.id) === id); },
        onDragEnd() { setIsOver(false); },
        onDragCancel() { setIsOver(false); },
    });

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY });
    };

    const handleMiddleMouseClick = (e: React.MouseEvent) => {
        if (e.button === 1) {
            e.preventDefault();
            onOpenInNewTab();
        }
    };

    return (
        <>
            {isOver && <div className="h-0.5 bg-blue-400 rounded mx-1 pointer-events-none" />}
            <div
                ref={setNodeRef}
                data-testid={`request-${id}`}
                data-active={isActive ? 'true' : 'false'}
                style={{
                    transform: CSS.Transform.toString(transform),
                    transition,
                    opacity: isDragging ? 0 : undefined,
                }}
                className={`flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-grab active:cursor-grabbing select-none ${
                    isActive ? 'bg-gray-600' : ''
                }`}
                onClick={onSelect}
                onContextMenu={handleContextMenu}
                onMouseDown={handleMiddleMouseClick}
                {...attributes}
                {...listeners}
            >
                <span className="text-[10px] font-mono text-blue-300 w-10 flex-shrink-0 truncate" title={method}>
                    {method}
                </span>

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
            {ctxMenu && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={(e) => {
                            e.stopPropagation();
                            setCtxMenu(null);
                        }}
                    />
                    <ul
                        role="menu"
                        className="fixed z-50 min-w-[10rem] rounded-md border border-app-subtle bg-app-main py-1 shadow-lg text-sm text-app-primary"
                        style={{ top: ctxMenu.y, left: ctxMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <li
                            role="menuitem"
                            className="px-3 py-1.5 hover:bg-app-subtle cursor-pointer"
                            onClick={() => {
                                onOpenInNewTab();
                                setCtxMenu(null);
                            }}
                        >
                            Open in New Tab
                        </li>
                    </ul>
                </>
            )}
        </>
    );
}

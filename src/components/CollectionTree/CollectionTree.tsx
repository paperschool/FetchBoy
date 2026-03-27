import { useState } from 'react';
import { Plus, Upload, ChevronRight, FolderInput } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Folder } from 'lucide-react';
import { CollectionRow } from './CollectionRow';
import { useCollectionTreeState } from './useCollectionTreeState';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
} from '@dnd-kit/core';
import { useCollectionStore } from '@/stores/collectionStore';
import { ImportWizard } from '@/components/ImportWizard/ImportWizard';

export function CollectionTree() {
    const [importWizardOpen, setImportWizardOpen] = useState(false);
    const {
        expanded,
        editingId,
        editingValue,
        editRef,
        tree,
        activeRequestId,
        toggle,
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
    } = useCollectionTreeState();

    const store = useCollectionStore();
    const expandedFolders = expanded;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const [dragging, setDragging] = useState<{
        type: 'folder' | 'request';
        id: string;
    } | null>(null);

    const draggingFolder = dragging?.type === 'folder'
        ? store.folders.find((f) => f.id === dragging.id)
        : null;
    const draggingRequest = dragging?.type === 'request'
        ? store.requests.find((r) => r.id === dragging.id)
        : null;

    const handleDragStart = (e: DragStartEvent) => {
        const data = e.active.data.current as { type: string } | undefined;
        if (data?.type === 'folder' || data?.type === 'request') {
            setDragging({ type: data.type as 'folder' | 'request', id: String(e.active.id) });
        }
    };

    const handleEditChange = (value: string) => {
        setEditingValue(value);
    };

    const handleCommitEdit = () => {
        void commitEdit();
    };

    const handleCancelEdit = () => {
        setEditingValue('');
        cancelEdit();
    };

    return (
        <>
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={(e) => {
                setDragging(null);
                void handleDragEnd(e);
            }}
            onDragCancel={() => setDragging(null)}
        >
            <div data-testid="collection-tree" className="text-sm">
                {/* Header */}
                <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-1">
                        <span className="text-app-muted text-[10px]">Create:</span>
                        <button
                            onClick={() => void handleAddCollection()}
                            aria-label="Add Collection"
                            title="New collection"
                            className="text-green-400 hover:text-green-300 p-1 rounded cursor-pointer"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-app-muted text-[10px]">Import:</span>
                        <button
                            onClick={() => setImportWizardOpen(true)}
                            aria-label="Import from Postman/Insomnia"
                            title="Import from Postman/Insomnia"
                            className="text-orange-400 hover:text-orange-300 p-1 rounded cursor-pointer"
                        >
                            <FolderInput size={14} />
                        </button>
                        <button
                            onClick={() => void handleImportCollection()}
                            aria-label="Import FetchBoy collection"
                            title="Import FetchBoy collection"
                            className="text-gray-300 hover:text-white p-1 rounded cursor-pointer"
                        >
                            <Upload size={14} />
                        </button>
                    </div>
                </div>

                {/* Empty state */}
                {tree.length === 0 && (
                    <div data-testid="empty-state">
                        <EmptyState
                            icon={Folder}
                            label="No collections yet — create one to get started"
                            action={() => void handleAddCollection()}
                            actionLabel="Create Collection"
                        />
                    </div>
                )}

                {/* Tree */}
                {tree.map((colNode) => {
                    const { item: col, folders: colFolders, requests: colRequests } = colNode;
                    const isColOpen = Boolean(expanded[col.id]);

                    return (
                        <CollectionRow
                            key={col.id}
                            collection={col}
                            folders={colFolders}
                            requests={colRequests}
                            isExpanded={isColOpen}
                            expandedFolders={expandedFolders}
                            editingId={editingId}
                            editingValue={editingValue}
                            editRef={editRef}
                            activeRequestId={activeRequestId}
                            // Collection actions
                            onToggle={() => toggle(col.id)}
                            onEditChange={handleEditChange}
                            onStartEdit={(name: string) => startEdit('collection', col.id, name)}
                            onCommitEdit={handleCommitEdit}
                            onCancelEdit={handleCancelEdit}
                            onAddFolder={() => void handleAddFolder(col.id)}
                            onAddRequest={() => void handleAddRequest(col.id)}
                            onExport={() => void handleExportCollection(col.id, col.name)}
                            onDeleteCollection={() => void handleDeleteCollection(col.id)}
                            // Folder actions
                            onToggleFolder={(folderId: string) => toggle(folderId)}
                            onEditFolder={(folderId: string, name: string) => startEdit('folder', folderId, name)}
                            onCommitEditFolder={handleCommitEdit}
                            onCancelEditFolder={handleCancelEdit}
                            onAddRequestToFolder={(folderId: string) => void handleAddRequest(col.id, folderId)}
                            onDeleteFolder={(folderId: string) => void handleDeleteFolder(folderId)}
                            // Request actions
                            onSelectRequest={(id: string) => handleLoadRequest(id)}
                            onDeleteRequest={(id: string) => void handleDeleteRequest(id)}
                            onUpdateRequest={(id: string) => void handleUpdateRequest(id)}
                            onOpenRequestInNewTab={(id: string) => handleOpenInNewTab(id)}
                        />
                    );
                })}
            </div>

            {/* Drag overlay — floating ghost following the cursor */}
            <DragOverlay dropAnimation={null}>
                {draggingFolder && (
                    <div className="flex items-center gap-1 py-0.5 px-2 rounded bg-gray-600 border border-blue-400 shadow-lg text-sm text-app-inverse select-none opacity-90">
                        <ChevronRight size={14} className="text-app-muted flex-shrink-0" />
                        <span className="truncate">{draggingFolder.name}</span>
                    </div>
                )}
                {draggingRequest && (
                    <div className="flex items-center gap-1 py-0.5 px-2 rounded bg-gray-600 border border-blue-400 shadow-lg text-sm text-app-inverse select-none opacity-90">
                        <span className="text-xs font-mono text-blue-300 w-8 flex-shrink-0">
                            {draggingRequest.method}
                        </span>
                        <span className="truncate">{draggingRequest.name}</span>
                    </div>
                )}
            </DragOverlay>
        </DndContext>
        <ImportWizard isOpen={importWizardOpen} onClose={() => setImportWizardOpen(false)} />
        </>
    );
}

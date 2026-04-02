import { useState, useEffect, useCallback, type RefObject, type MouseEvent, type ChangeEvent, type KeyboardEvent } from 'react';
import { useInlineRename } from '@/hooks/useInlineRename';
import { TabContextMenu } from './TabContextMenu';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTabStore } from '@/stores/tabStore';
import { useShallow } from 'zustand/react/shallow';
import { X, Plus } from 'lucide-react';

type TabContextMenuState = { x: number; y: number; tabId: string } | null;

type SortableTabItemProps = {
    id: string;
    label: string;
    isActive: boolean;
    isBlocked: boolean;
    isOnly: boolean;
    isEditing: boolean;
    editValue: string;
    inputRef: RefObject<HTMLInputElement>;
    onTabClick: () => void;
    onLabelDoubleClick: (event: MouseEvent) => void;
    onCloseClick: (event: MouseEvent) => void;
    onContextMenu: (event: MouseEvent) => void;
    onEditChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onEditBlur: () => void;
    onEditKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

function SortableTabItem({
    id,
    label,
    isActive,
    isBlocked,
    isOnly,
    isEditing,
    editValue,
    inputRef,
    onTabClick,
    onLabelDoubleClick,
    onCloseClick,
    onContextMenu,
    onEditChange,
    onEditBlur,
    onEditKeyDown,
}: SortableTabItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            role="tab"
            aria-selected={isActive}
                className={`group relative mx-1 mt-1 flex h-[calc(100%-0.25rem)] min-w-0 max-w-[10rem] shrink-0 cursor-pointer select-none items-center gap-1 rounded-t-md border-x border-t border-b-0 px-3 text-sm transition-colors ${
                isActive
                    ? 'border-app-subtle bg-app-main text-app-primary shadow-sm'
                    : 'border-transparent bg-app-sidebar text-gray-400 hover:border-app-subtle hover:bg-app-main'
            } ${isBlocked ? 'animate-pulse ring-1 ring-amber-400/70' : ''}`}
            onClick={onTabClick}
            onContextMenu={onContextMenu}
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    className="w-full min-w-0 bg-transparent text-sm outline-none"
                    value={editValue}
                    onChange={onEditChange}
                    onBlur={onEditBlur}
                    onKeyDown={onEditKeyDown}
                />
            ) : (
                <span className="truncate max-w-[160px]" onDoubleClick={onLabelDoubleClick}>
                    {label}
                </span>
            )}
            {!isOnly && (
                <button
                    className="ml-1 shrink-0 cursor-pointer rounded p-0.5 text-app-secondary opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    aria-label={`Close tab ${label}`}
                    onClick={onCloseClick}
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
}

export function TabBar() {
    const { tabs, activeTabId } = useTabStore(useShallow((s) => ({ tabs: s.tabs, activeTabId: s.activeTabId })));
    const { addTab, closeTab, reorderTabs, duplicateTab, closeOtherTabs, closeAllTabs, setActiveTab, renameTab, syncLabelFromRequest } = useTabStore(useShallow((s) => ({
        addTab: s.addTab, closeTab: s.closeTab, reorderTabs: s.reorderTabs,
        duplicateTab: s.duplicateTab, closeOtherTabs: s.closeOtherTabs, closeAllTabs: s.closeAllTabs,
        setActiveTab: s.setActiveTab, renameTab: s.renameTab, syncLabelFromRequest: s.syncLabelFromRequest,
    })));

    const method = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.requestState.method ?? 'GET');
    const url = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.requestState.url ?? '');

    const handleRenameCallback = useCallback((tabId: string, newName: string) => {
        const tab = tabs.find((t) => t.id === tabId);
        renameTab(tabId, newName.trim() || tab?.label || 'Untitled');
    }, [tabs, renameTab]);

    const rename = useInlineRename(handleRenameCallback);
    const [tabCtxMenu, setTabCtxMenu] = useState<TabContextMenuState>(null);
    const [blockedTabId, setBlockedTabId] = useState<string | null>(null);
    const isMac = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');
    const tabIds = tabs.map((tab) => tab.id);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
    );

    // Sync active tab label to current request method + URL
    useEffect(() => {
        syncLabelFromRequest(activeTabId, method, url);
    }, [method, url, activeTabId, syncLabelFromRequest]);

    useEffect(() => {
        const handler = (event: Event) => {
            const custom = event as CustomEvent<{ tabId?: string }>;
            const tabId = custom.detail?.tabId;
            if (!tabId) return;
            setBlockedTabId(tabId);
            window.setTimeout(() => setBlockedTabId((current) => (current === tabId ? null : current)), 220);
        };

        window.addEventListener('tab-close-blocked', handler as EventListener);
        return () => {
            window.removeEventListener('tab-close-blocked', handler as EventListener);
        };
    }, []);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = tabIds.indexOf(String(active.id));
        const newIndex = tabIds.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1) return;

        const newOrder = arrayMove(tabIds, oldIndex, newIndex);
        reorderTabs(newOrder);
    };

    const closeMenu = () => setTabCtxMenu(null);

    return (
        <>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="flex h-[2.25rem] items-center overflow-x-auto border-b border-app-subtle bg-app-sidebar">
                    <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
                        {tabs.map((tab) => {
                            const isActive = tab.id === activeTabId;
                            const isEditing = rename.editingId === tab.id;

                            return (
                                <SortableTabItem
                                    key={tab.id}
                                    id={tab.id}
                                    label={tab.label}
                                    isActive={isActive}
                                    isBlocked={blockedTabId === tab.id}
                                    isOnly={tabs.length === 1}
                                    isEditing={isEditing}
                                    editValue={rename.editValue}
                                    inputRef={rename.editRef}
                                    onTabClick={() => !isEditing && setActiveTab(tab.id)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                                    }}
                                    onLabelDoubleClick={(e) => {
                                        e.stopPropagation();
                                        rename.startEditing(tab.id, tab.label);
                                    }}
                                    onCloseClick={(e) => {
                                        e.stopPropagation();
                                        closeTab(tab.id);
                                    }}
                                    onEditChange={(e) => rename.setEditValue(e.target.value)}
                                    onEditBlur={rename.handleBlur}
                                    onEditKeyDown={rename.handleKeyDown}
                                />
                            );
                        })}
                    </SortableContext>

                    <button
                        className="mx-1 mt-1 flex h-[calc(100%-0.25rem)] shrink-0 cursor-pointer items-center rounded-t-md border-x border-t border-b-0 border-transparent px-2 text-gray-400 transition-colors hover:border-app-subtle hover:bg-app-main hover:text-white"
                        aria-label="New tab"
                        title={`New Tab (${isMac ? '⌘T' : 'Ctrl+T'})`}
                        onClick={() => addTab()}
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </DndContext>

            <TabContextMenu
                menu={tabCtxMenu}
                onClose={closeMenu}
                isMac={isMac}
                tabCount={tabs.length}
                onNewTab={addTab}
                onDuplicateTab={duplicateTab}
                onCloseTab={closeTab}
                onCloseOtherTabs={closeOtherTabs}
                onCloseAllTabs={closeAllTabs}
            />
        </>
    );
}

import { useState, useEffect, useRef, type RefObject, type MouseEvent, type ChangeEvent, type KeyboardEvent } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTabStore } from '@/stores/tabStore';
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
    const tabs = useTabStore((s) => s.tabs);
    const activeTabId = useTabStore((s) => s.activeTabId);
    const addTab = useTabStore((s) => s.addTab);
    const closeTab = useTabStore((s) => s.closeTab);
    const reorderTabs = useTabStore((s) => s.reorderTabs);
    const duplicateTab = useTabStore((s) => s.duplicateTab);
    const closeOtherTabs = useTabStore((s) => s.closeOtherTabs);
    const closeAllTabs = useTabStore((s) => s.closeAllTabs);
    const setActiveTab = useTabStore((s) => s.setActiveTab);
    const renameTab = useTabStore((s) => s.renameTab);
    const syncLabelFromRequest = useTabStore((s) => s.syncLabelFromRequest);

    const method = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.requestState.method ?? 'GET');
    const url = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.requestState.url ?? '');

    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [tabCtxMenu, setTabCtxMenu] = useState<TabContextMenuState>(null);
    const [blockedTabId, setBlockedTabId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
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

    // Auto-focus inline rename input
    useEffect(() => {
        if (editingTabId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingTabId]);

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

    const handleDoubleClick = (tabId: string, currentLabel: string) => {
        setEditingTabId(tabId);
        setEditValue(currentLabel);
    };

    const handleRenameConfirm = (tabId: string, fallbackLabel: string) => {
        renameTab(tabId, editValue.trim() || fallbackLabel);
        setEditingTabId(null);
    };

    const handleRenameCancel = () => {
        setEditingTabId(null);
    };

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
                            const isEditing = editingTabId === tab.id;

                            return (
                                <SortableTabItem
                                    key={tab.id}
                                    id={tab.id}
                                    label={tab.label}
                                    isActive={isActive}
                                    isBlocked={blockedTabId === tab.id}
                                    isOnly={tabs.length === 1}
                                    isEditing={isEditing}
                                    editValue={editValue}
                                    inputRef={inputRef}
                                    onTabClick={() => !isEditing && setActiveTab(tab.id)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                                    }}
                                    onLabelDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleDoubleClick(tab.id, tab.label);
                                    }}
                                    onCloseClick={(e) => {
                                        e.stopPropagation();
                                        closeTab(tab.id);
                                    }}
                                    onEditChange={(e) => setEditValue(e.target.value)}
                                    onEditBlur={() => handleRenameConfirm(tab.id, tab.label)}
                                    onEditKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleRenameConfirm(tab.id, tab.label);
                                        } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            handleRenameCancel();
                                        }
                                    }}
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

            {tabCtxMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={closeMenu} />
                    <ul
                        role="menu"
                        className="fixed z-50 min-w-[10rem] rounded-md border border-app-subtle bg-app-main py-1 shadow-lg text-sm text-app-primary"
                        style={{ top: tabCtxMenu.y, left: tabCtxMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <li
                            role="menuitem"
                            className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-app-subtle"
                            onClick={() => {
                                addTab();
                                closeMenu();
                            }}
                        >
                            <span>New Tab</span>
                            <span className="ml-auto text-xs text-app-muted">{isMac ? '⌘T' : 'Ctrl+T'}</span>
                        </li>
                        <li
                            role="menuitem"
                            className="px-3 py-1.5 hover:bg-app-subtle cursor-pointer"
                            onClick={() => {
                                duplicateTab(tabCtxMenu.tabId);
                                closeMenu();
                            }}
                        >
                            Duplicate Tab
                        </li>
                        <li
                            role="menuitem"
                            className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-app-subtle"
                            onClick={() => {
                                closeTab(tabCtxMenu.tabId);
                                closeMenu();
                            }}
                        >
                            <span>Close Tab</span>
                            <span className="ml-auto text-xs text-app-muted">{isMac ? '⌘W' : 'Ctrl+W'}</span>
                        </li>
                        <li
                            role="menuitem"
                            className={`px-3 py-1.5 ${
                                tabs.length === 1 ? 'cursor-not-allowed text-app-muted' : 'cursor-pointer hover:bg-app-subtle'
                            }`}
                            onClick={() => {
                                if (tabs.length === 1) return;
                                closeOtherTabs(tabCtxMenu.tabId);
                                closeMenu();
                            }}
                        >
                            Close Other Tabs
                        </li>
                        <li
                            role="menuitem"
                            className="px-3 py-1.5 hover:bg-app-subtle cursor-pointer"
                            onClick={() => {
                                closeAllTabs();
                                closeMenu();
                            }}
                        >
                            Close All Tabs
                        </li>
                    </ul>
                </>
            )}
        </>
    );
}

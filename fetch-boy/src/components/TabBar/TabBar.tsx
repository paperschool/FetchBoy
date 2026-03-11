import { useState, useEffect, useRef } from 'react';
import { useTabStore } from '@/stores/tabStore';
import { X, Plus } from 'lucide-react';

export function TabBar() {
    const tabs = useTabStore((s) => s.tabs);
    const activeTabId = useTabStore((s) => s.activeTabId);
    const addTab = useTabStore((s) => s.addTab);
    const closeTab = useTabStore((s) => s.closeTab);
    const setActiveTab = useTabStore((s) => s.setActiveTab);
    const renameTab = useTabStore((s) => s.renameTab);
    const syncLabelFromRequest = useTabStore((s) => s.syncLabelFromRequest);

    const method = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.requestState.method ?? 'GET');
    const url = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.requestState.url ?? '');

    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

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

    return (
        <div className="flex h-[2.25rem] items-center overflow-x-auto border-b border-app-subtle bg-app-sidebar">
            {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const isEditing = editingTabId === tab.id;

                return (
                    <div
                        key={tab.id}
                        role="tab"
                        aria-selected={isActive}
                        className={`group relative flex h-full min-w-0 max-w-[10rem] shrink-0 cursor-pointer select-none items-center gap-1 border-r border-app-subtle px-3 text-sm ${
                            isActive
                                ? 'border-b-2 border-b-blue-500 bg-app-main text-app-primary'
                                : 'bg-app-sidebar text-app-secondary hover:bg-app-main'
                        }`}
                        onClick={() => !isEditing && setActiveTab(tab.id)}
                    >
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                className="w-full min-w-0 bg-transparent text-sm outline-none"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleRenameConfirm(tab.id, tab.label)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleRenameConfirm(tab.id, tab.label);
                                    } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        handleRenameCancel();
                                    }
                                }}
                            />
                        ) : (
                            <span
                                className="truncate max-w-[160px]"
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleDoubleClick(tab.id, tab.label);
                                }}
                            >
                                {tab.label}
                            </span>
                        )}
                        <button
                            className="ml-1 shrink-0 rounded p-0.5 text-app-secondary opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                            aria-label={`Close tab ${tab.label}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                closeTab(tab.id);
                            }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                );
            })}

            <button
                className="flex h-full shrink-0 items-center px-2 text-app-secondary hover:bg-app-main hover:text-app-primary"
                aria-label="New tab"
                onClick={() => addTab()}
            >
                <Plus size={14} />
            </button>
        </div>
    );
}

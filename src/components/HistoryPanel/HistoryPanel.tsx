import { useEffect, useState } from 'react';
import { Trash2, X, Check, History } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { clearHistory, loadHistory } from '@/lib/history';
import { formatRelativeTime } from '@/lib/utils';
import { useHistoryStore } from '@/stores/historyStore';
import { useTabStore } from '@/stores/tabStore';
import { buildSnapshotFromSaved } from '@/lib/requestSnapshotUtils';

function methodColour(method: string): string {
    const map: Record<string, string> = {
        GET: 'text-blue-400',
        POST: 'text-green-400',
        PUT: 'text-orange-400',
        PATCH: 'text-yellow-400',
        DELETE: 'text-red-400',
    };
    return map[method.toUpperCase()] ?? 'text-gray-400';
}

function statusColour(status: number): string {
    if (status === 0) return 'text-gray-400';
    if (status < 300) return 'text-green-400';
    if (status < 400) return 'text-blue-400';
    if (status < 500) return 'text-yellow-400';
    return 'text-red-400';
}

function statusLabel(status: number): string {
    return status === 0 ? 'ERR' : String(status);
}

export function HistoryPanel() {
    const entries = useHistoryStore((state) => state.entries);
    const historyStore = useHistoryStore();
    const [isConfirmingClear, setIsConfirmingClear] = useState(false);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entryId: string } | null>(null);

    useEffect(() => {
        loadHistory()
            .then((loaded) => historyStore.loadAll(loaded))
            .catch(() => {
                // Swallow errors gracefully (non-Tauri test env)
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRowClick = (entry: (typeof entries)[number]) => {
        const { activeTabId, tabs, updateTabRequestState } = useTabStore.getState();
        const activeTabEntry = tabs.find((t) => t.id === activeTabId);
        if (activeTabEntry?.requestState.isDirty) {
            if (!window.confirm('You have unsaved changes. Discard and load this request?')) {
                return;
            }
        }
        updateTabRequestState(activeTabId, buildSnapshotFromSaved(entry.request_snapshot));
    };

    const handleOpenInNewTab = (entry: (typeof entries)[number]) => {
        const snapshot = buildSnapshotFromSaved(entry.request_snapshot);
        const raw = `${entry.request_snapshot.method} ${entry.request_snapshot.url}`;
        const label = raw.length > 30 ? raw.slice(0, 27) + '\u2026' : raw;
        useTabStore.getState().openRequestInNewTab(snapshot, label);
    };

    const handleClearHistory = async () => {
        try {
            await clearHistory();
            historyStore.clearAll();
        } catch {
            // Swallow silently, consistent with CollectionTree pattern
        } finally {
            setIsConfirmingClear(false);
        }
    };

    return (
        <div data-testid="history-panel" className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-app-muted font-medium uppercase tracking-wide">
                    History
                </span>
                {isConfirmingClear ? (
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-app-muted">Clear all?</span>
                        <button
                            type="button"
                            onClick={handleClearHistory}
                            aria-label="Confirm clear history"
                            className="p-1 text-red-400 hover:text-red-300 rounded cursor-pointer"
                            title="Confirm"
                        >
                            <Check size={13} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsConfirmingClear(false)}
                            aria-label="Cancel clear history"
                            className="p-1 text-app-muted hover:text-app-inverse rounded cursor-pointer"
                            title="Cancel"
                        >
                            <X size={13} />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsConfirmingClear(true)}
                        aria-label="Clear History"
                        className="p-1 text-app-muted hover:text-red-400 rounded cursor-pointer"
                        title="Clear History"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>

            {entries.length === 0 ? (
                <div data-testid="history-empty-state">
                    <EmptyState
                        icon={History}
                        label="Your sent requests will appear here"
                    />
                </div>
            ) : (
                <ul className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            data-testid={`history-row-${entry.id}`}
                            onClick={() => handleRowClick(entry)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, entryId: entry.id }); }}
                            onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); handleOpenInNewTab(entry); } }}
                            className="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer hover:bg-gray-700"
                        >
                            <span
                                className={`font-mono text-xs font-bold uppercase w-14 shrink-0 ${methodColour(entry.method)}`}
                            >
                                {entry.method}
                            </span>
                            <span className="flex-1 truncate text-app-primary text-xs">
                                {entry.url}
                            </span>
                            <span
                                className={`text-xs font-mono shrink-0 ${statusColour(entry.status_code)}`}
                            >
                                {statusLabel(entry.status_code)}
                            </span>
                            <span
                                className="text-xs text-app-muted shrink-0"
                                title={entry.sent_at}
                            >
                                {formatRelativeTime(entry.sent_at)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {ctxMenu && (() => {
                const entry = entries.find((e) => e.id === ctxMenu.entryId);
                if (!entry) return null;
                return (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => { e.stopPropagation(); setCtxMenu(null); }}
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
                                onClick={() => { handleOpenInNewTab(entry); setCtxMenu(null); }}
                            >
                                Open in New Tab
                            </li>
                        </ul>
                    </>
                );
            })()}
        </div>
    );
}

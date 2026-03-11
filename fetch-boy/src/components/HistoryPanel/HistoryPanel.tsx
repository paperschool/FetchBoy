import { useEffect, useState } from 'react';
import { Trash2, X, Check } from 'lucide-react';
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
                <div
                    data-testid="history-empty-state"
                    className="flex-1 flex items-center justify-center text-xs text-app-muted text-center"
                >
                    No history yet. Send a request to get started.
                </div>
            ) : (
                <ul className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            data-testid={`history-row-${entry.id}`}
                            onClick={() => handleRowClick(entry)}
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
        </div>
    );
}

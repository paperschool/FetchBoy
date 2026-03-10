import { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { clearHistory, loadHistory } from '@/lib/history';
import { formatRelativeTime } from '@/lib/utils';
import { useHistoryStore } from '@/stores/historyStore';
import { useRequestStore } from '@/stores/requestStore';

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
    const requestStore = useRequestStore();

    useEffect(() => {
        loadHistory()
            .then((loaded) => historyStore.loadAll(loaded))
            .catch(() => {
                // Swallow errors gracefully (non-Tauri test env)
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRowClick = (entry: (typeof entries)[number]) => {
        if (requestStore.isDirty) {
            if (!window.confirm('You have unsaved changes. Discard and load this request?')) {
                return;
            }
        }
        requestStore.loadFromSaved(entry.request_snapshot);
    };

    const handleClearHistory = async () => {
        if (!window.confirm('Clear all history?')) return;
        try {
            await clearHistory();
            historyStore.clearAll();
        } catch {
            // Swallow silently, consistent with CollectionTree pattern
        }
    };

    return (
        <div data-testid="history-panel" className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-app-muted font-medium uppercase tracking-wide">
                    History
                </span>
                <button
                    type="button"
                    onClick={handleClearHistory}
                    aria-label="Clear History"
                    className="p-1 text-app-muted hover:text-red-400 rounded cursor-pointer"
                    title="Clear History"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {entries.length === 0 ? (
                <div
                    data-testid="history-empty-state"
                    className="flex-1 flex items-center justify-center text-xs text-app-muted text-center"
                >
                    No history yet. Send a request to get started.
                </div>
            ) : (
                <ul className="flex-1 overflow-y-auto space-y-0.5">
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

import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useMappingLogStore } from '@/stores/mappingLogStore';
import { formatTimestamp, filterLogEntries, OVERRIDE_ICONS } from './MappingLogTable.utils';
import { t } from '@/lib/i18n';

export function MappingLogTable() {
    const { entries, searchQuery, setSearchQuery, clearLog } = useMappingLogStore();

    const filtered = useMemo(
        () => filterLogEntries(entries, searchQuery),
        [entries, searchQuery],
    );

    return (
        <div className="h-full flex flex-col min-h-0" data-testid="mapping-log-table">
            {/* Control bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-app-main border-b border-app-subtle shrink-0">
                <span className="text-xs text-app-muted">
                    {entries.length > 0
                        ? t('intercept.mappingLogCount', { filtered: String(filtered.length), total: String(entries.length), plural: entries.length !== 1 ? 's' : '' })
                        : t('intercept.noOverrides')}
                </span>
                {entries.length > 0 && (
                    <button onClick={clearLog}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs text-app-muted hover:text-red-400 hover:bg-app-subtle rounded transition-colors"
                        title={t('intercept.clearLog')} data-testid="mapping-log-clear">
                        <Trash2 size={14} /> {t('common.clear')}
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-app-main border-b border-app-subtle shrink-0">
                <input type="text" value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('intercept.filterByUrlOrMapping')}
                    className="flex-1 bg-app-subtle border border-app-subtle rounded px-2 py-1 text-xs text-app-primary placeholder:text-app-muted outline-none focus:border-blue-500/50"
                    data-testid="mapping-log-search" />
            </div>

            {/* Header */}
            {filtered.length > 0 && (
                <div className="flex bg-app-main border-b border-app-subtle shrink-0">
                    <div className="px-2 py-1.5 text-left text-xs font-medium text-app-secondary uppercase w-[90px] shrink-0">{t('intercept.colTime')}</div>
                    <div className="px-2 py-1.5 text-left text-xs font-medium text-app-secondary uppercase flex-1 min-w-0">{t('intercept.colUrlRequestId')}</div>
                    <div className="px-2 py-1.5 text-left text-xs font-medium text-app-secondary uppercase w-[60px] shrink-0">{t('intercept.colSource')}</div>
                    <div className="px-2 py-1.5 text-left text-xs font-medium text-app-secondary uppercase w-[120px] shrink-0">{t('intercept.colRule')}</div>
                    <div className="px-2 py-1.5 text-left text-xs font-medium text-app-secondary uppercase w-[100px] shrink-0">{t('intercept.colOverrides')}</div>
                </div>
            )}

            {/* Rows */}
            <div className="flex-1 overflow-y-auto">
                {filtered.map((entry) => (
                    <div key={entry.id} className="flex items-center border-b border-app-subtle hover:bg-app-subtle transition-colors"
                        data-testid={`mapping-log-row-${entry.id}`}>
                        <div className="px-2 py-1.5 text-xs text-app-muted w-[90px] shrink-0 tabular-nums">
                            {formatTimestamp(entry.timestamp)}
                        </div>
                        <div className="px-2 py-1.5 text-xs text-app-primary flex-1 min-w-0 truncate" title={entry.url}>
                            {entry.remappedUrl ? (
                                <span>{entry.originalUrl} <span className="text-blue-400">→</span> {entry.remappedUrl}</span>
                            ) : entry.url}
                        </div>
                        <div className="px-2 py-1.5 w-[60px] shrink-0">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${entry.source === 'mapping' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                                {entry.source === 'mapping' ? 'MAP' : 'BP'}
                            </span>
                        </div>
                        <div className="px-2 py-1.5 text-xs text-app-secondary w-[120px] shrink-0 truncate" title={entry.mappingName}>
                            {entry.mappingName}
                        </div>
                        <div className="px-2 py-1.5 w-[100px] shrink-0 flex gap-1">
                            {entry.overridesApplied.map((o) => {
                                const icon = OVERRIDE_ICONS[o];
                                return icon ? (
                                    <span key={o} className={`text-[10px] font-bold ${icon.color}`} title={icon.tooltip}>{icon.label}</span>
                                ) : null;
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {entries.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-app-muted text-sm">
                    {t('intercept.noOverridesLogged')}
                </div>
            )}
        </div>
    );
}

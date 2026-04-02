import { useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Trash2, Pin, PinOff } from 'lucide-react'
import { useDebugStore } from '@/stores/debugStore'
import { formatTimestamp } from '@/components/InterceptView/InterceptTable.utils'
import { t } from '@/lib/i18n'

const LEVEL_BADGE: Record<string, string> = {
    info: 'bg-blue-500/20 text-blue-400',
    warn: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400',
}

const columns = [
    { id: 'time', key: 'intercept.colTime' as const, className: 'w-[100px] shrink-0' },
    { id: 'level', key: 'intercept.colLevel' as const, className: 'w-[80px] shrink-0' },
    { id: 'source', key: 'intercept.colSource' as const, className: 'w-[120px] shrink-0' },
    { id: 'message', key: 'intercept.colMessage' as const, className: 'flex-1 min-w-0' },
]

const ROW_HEIGHT = 32

export function InternalEventTable() {
    const events = useDebugStore((s) => s.internalEvents)
    const clearInternal = useDebugStore((s) => s.clearInternal)
    const [filter, setFilter] = useState('')
    const [pinned, setPinned] = useState(false)
    const parentRef = useRef<HTMLDivElement>(null)

    const filtered = filter
        ? events.filter((e) => e.message.toLowerCase().includes(filter.toLowerCase()) || e.source.toLowerCase().includes(filter.toLowerCase()))
        : events

    const rowVirtualizer = useVirtualizer({
        count: filtered.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 15,
        getItemKey: (index) => filtered[index]?.id ?? index,
    })

    // Auto-scroll to bottom when not pinned
    useEffect(() => {
        if (!pinned && parentRef.current) {
            parentRef.current.scrollTop = parentRef.current.scrollHeight
        }
    }, [events.length, pinned])

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-app-subtle shrink-0">
                <span className="text-xs font-semibold text-app-muted uppercase tracking-wider">{t('intercept.debugInternal')}</span>
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('intercept.debugFilter')}
                    className="flex-1 bg-app-main text-app-inverse text-xs border border-app-subtle rounded px-2 py-1"
                />
                <button onClick={() => setPinned((p) => !p)} title={pinned ? t('intercept.unpinScroll') : t('intercept.pinScroll')} className="text-app-muted hover:text-app-inverse p-1 cursor-pointer">
                    {pinned ? <PinOff size={12} /> : <Pin size={12} />}
                </button>
                <button onClick={clearInternal} title={t('common.clear')} className="text-app-muted hover:text-app-inverse p-1 cursor-pointer">
                    <Trash2 size={12} />
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-app-muted text-xs">{t('intercept.noEvents')}</div>
            ) : (
                <>
                    <div className="flex bg-app-main border-b border-app-subtle shrink-0">
                        {columns.map((col) => (
                            <div key={col.id} className={`px-2 py-1.5 text-left text-xs font-medium text-app-secondary uppercase ${col.className}`}>
                                {t(col.key)}
                            </div>
                        ))}
                    </div>

                    <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0">
                        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const e = filtered[virtualRow.index]
                                if (!e) return null
                                return (
                                    <div
                                        key={e.id}
                                        className="absolute w-full flex items-center border-b border-app-subtle hover:bg-app-subtle transition-colors"
                                        style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                                    >
                                        <div className="px-2 text-xs text-app-muted w-[100px] shrink-0 tabular-nums">
                                            {formatTimestamp(e.timestamp)}
                                        </div>
                                        <div className="px-2 w-[80px] shrink-0">
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${LEVEL_BADGE[e.level] ?? 'bg-gray-500/20 text-gray-400'}`}>
                                                {e.level.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="px-2 w-[120px] shrink-0 text-xs text-app-muted truncate" title={e.source}>
                                            {e.source}
                                        </div>
                                        <div className="px-2 text-xs text-app-primary flex-1 min-w-0 truncate" title={e.message}>
                                            {e.message}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

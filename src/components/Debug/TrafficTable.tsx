import { useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Trash2, Pin, PinOff } from 'lucide-react'
import { useDebugStore } from '@/stores/debugStore'
import { formatTimestamp, formatMethod, formatStatusCode, CopyButton } from '@/components/Intercept view/InterceptTable.utils'

const columns = [
    { id: 'time', label: 'Time', className: 'w-[100px] shrink-0' },
    { id: 'method', label: 'Method', className: 'w-[85px] shrink-0' },
    { id: 'url', label: 'URL', className: 'flex-1 min-w-0' },
    { id: 'status', label: 'Status', className: 'w-[80px] shrink-0' },
    { id: 'duration', label: 'Duration', className: 'w-[80px] shrink-0' },
]

const ROW_HEIGHT = 32

export function TrafficTable() {
    const events = useDebugStore((s) => s.trafficEvents)
    const clearTraffic = useDebugStore((s) => s.clearTraffic)
    const [filter, setFilter] = useState('')
    const [pinned, setPinned] = useState(false)
    const parentRef = useRef<HTMLDivElement>(null)

    const filtered = filter
        ? events.filter((e) => e.url.toLowerCase().includes(filter.toLowerCase()) || e.method.toLowerCase().includes(filter.toLowerCase()))
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
                <span className="text-xs font-semibold text-app-muted uppercase tracking-wider">Traffic</span>
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter..."
                    className="flex-1 bg-app-main text-app-inverse text-xs border border-app-subtle rounded px-2 py-1"
                />
                <button onClick={() => setPinned((p) => !p)} title={pinned ? 'Unpin scroll' : 'Pin scroll'} className="text-app-muted hover:text-app-inverse p-1 cursor-pointer">
                    {pinned ? <PinOff size={12} /> : <Pin size={12} />}
                </button>
                <button onClick={clearTraffic} title="Clear" className="text-app-muted hover:text-app-inverse p-1 cursor-pointer">
                    <Trash2 size={12} />
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-app-muted text-xs">No traffic</div>
            ) : (
                <>
                    <div className="flex bg-app-main border-b border-app-subtle shrink-0">
                        {columns.map((col) => (
                            <div key={col.id} className={`px-2 py-1.5 text-left text-xs font-medium text-app-secondary uppercase ${col.className}`}>
                                {col.label}
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
                                        <div className="px-2 w-[85px] shrink-0">
                                            {formatMethod(e.method)}
                                        </div>
                                        <div className="px-2 text-xs text-app-primary flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                                            <span className="truncate" title={e.url}>{e.url}</span>
                                            <CopyButton text={e.url} />
                                        </div>
                                        <div className="px-2 w-[80px] shrink-0 text-xs tabular-nums">
                                            {formatStatusCode(e.status ?? undefined, e.status === null)}
                                        </div>
                                        <div className="px-2 w-[80px] shrink-0 text-xs text-app-muted tabular-nums text-right">
                                            {e.durationMs !== null ? `${e.durationMs}ms` : ''}
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

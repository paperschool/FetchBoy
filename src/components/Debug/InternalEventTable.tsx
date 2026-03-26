import { useRef, useState, useEffect } from 'react'
import { Trash2, Pin, PinOff } from 'lucide-react'
import { useDebugStore } from '@/stores/debugStore'
import { formatTimestamp } from '@/components/Intercept view/InterceptTable.utils'

const LEVEL_BADGE: Record<string, string> = {
    info: 'bg-blue-500/20 text-blue-400',
    warn: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400',
}

const columns = [
    { id: 'time', label: 'Time', className: 'w-[100px] shrink-0' },
    { id: 'level', label: 'Level', className: 'w-[80px] shrink-0' },
    { id: 'source', label: 'Source', className: 'w-[120px] shrink-0' },
    { id: 'message', label: 'Message', className: 'flex-1 min-w-0' },
]

export function InternalEventTable() {
    const events = useDebugStore((s) => s.internalEvents)
    const clearInternal = useDebugStore((s) => s.clearInternal)
    const [filter, setFilter] = useState('')
    const [pinned, setPinned] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    const filtered = filter
        ? events.filter((e) => e.message.toLowerCase().includes(filter.toLowerCase()) || e.source.toLowerCase().includes(filter.toLowerCase()))
        : events

    useEffect(() => {
        if (!pinned && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [events.length, pinned])

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-app-subtle shrink-0">
                <span className="text-xs font-semibold text-app-muted uppercase tracking-wider">Internal</span>
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
                <button onClick={clearInternal} title="Clear" className="text-app-muted hover:text-app-inverse p-1 cursor-pointer">
                    <Trash2 size={12} />
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-app-muted text-xs">No events</div>
            ) : (
                <>
                    {/* Column headers */}
                    <div className="flex bg-app-main border-b border-app-subtle shrink-0">
                        {columns.map((col) => (
                            <div key={col.id} className={`px-2 py-1.5 text-left text-xs font-medium text-app-secondary uppercase ${col.className}`}>
                                {col.label}
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
                        {filtered.map((e) => (
                            <div key={e.id} className="flex items-center h-[32px] border-b border-app-subtle hover:bg-app-subtle transition-colors">
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
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

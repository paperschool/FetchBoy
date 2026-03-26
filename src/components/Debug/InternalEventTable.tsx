import { useRef, useState, useEffect } from 'react'
import { Trash2, Pin, PinOff } from 'lucide-react'
import { useDebugStore } from '@/stores/debugStore'

const LEVEL_COLORS: Record<string, string> = {
    info: 'text-blue-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
}

function formatTime(ts: number): string {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

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
            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 text-xs font-mono">
                {filtered.length === 0 && (
                    <p className="text-app-muted text-center py-4">No events</p>
                )}
                {filtered.map((e) => (
                    <div key={e.id} className="flex gap-2 px-2 py-0.5 border-b border-app-subtle/50 hover:bg-app-subtle/30">
                        <span className="text-app-muted tabular-nums shrink-0 w-[60px]">{formatTime(e.timestamp)}</span>
                        <span className={`shrink-0 w-[36px] font-semibold ${LEVEL_COLORS[e.level] ?? 'text-app-muted'}`}>{e.level.toUpperCase()}</span>
                        <span className="text-app-muted shrink-0 w-[60px] truncate">{e.source}</span>
                        <span className="text-app-inverse flex-1 truncate">{e.message}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

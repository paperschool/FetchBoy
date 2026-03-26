import { useEffect, useRef, useState, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { useUiSettingsStore } from '@/stores/uiSettingsStore'

const STAGES = [
    { id: 'incoming', label: 'Incoming' },
    { id: 'tls-decrypt', label: 'TLS Decrypt' },
    { id: 'breakpoint-check', label: 'Breakpoint Check' },
    { id: 'mapping-match', label: 'Mapping Match' },
    { id: 'upstream-forward', label: 'Upstream Forward' },
    { id: 'response-received', label: 'Response Received' },
    { id: 'mapping-apply', label: 'Mapping Apply' },
    { id: 'client-response', label: 'Client Response' },
] as const

type StageId = (typeof STAGES)[number]['id']

const EVENT_STAGE_MAP: Record<string, StageId[]> = {
    'intercept:request-split': ['incoming', 'tls-decrypt', 'breakpoint-check'],
    'intercept:response-split': ['upstream-forward', 'response-received', 'client-response'],
    'mapping:applied': ['mapping-match', 'mapping-apply'],
}

export function ProxyFlowDiagram() {
    const proxyEnabled = useUiSettingsStore((s) => s.proxyEnabled)
    const [active, setActive] = useState<Record<string, boolean>>({})
    const [counters, setCounters] = useState<Record<string, number>>({})
    const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

    const flashStages = useCallback((stages: StageId[]) => {
        setActive((prev) => {
            const next = { ...prev }
            for (const id of stages) next[id] = true
            return next
        })
        setCounters((prev) => {
            const next = { ...prev }
            for (const id of stages) next[id] = (next[id] || 0) + 1
            return next
        })
        for (const id of stages) {
            if (timersRef.current[id]) clearTimeout(timersRef.current[id])
            timersRef.current[id] = setTimeout(() => {
                setActive((prev) => ({ ...prev, [id]: false }))
            }, 150)
        }
    }, [])

    // Reset counters when proxy stops
    useEffect(() => {
        if (!proxyEnabled) setCounters({})
    }, [proxyEnabled])

    // Listen to events
    useEffect(() => {
        const unlisten: UnlistenFn[] = []
        let cancelled = false

        for (const [eventName, stages] of Object.entries(EVENT_STAGE_MAP)) {
            listen(eventName, () => flashStages(stages))
                .then((fn) => { if (cancelled) fn(); else unlisten.push(fn) })
                .catch(() => {})
        }

        return () => {
            cancelled = true
            unlisten.forEach((fn) => fn())
        }
    }, [flashStages])

    // Cleanup timers on unmount
    useEffect(() => {
        const timers = timersRef.current
        return () => { Object.values(timers).forEach(clearTimeout) }
    }, [])

    return (
        <div className="shrink-0 px-4 py-3 border-t border-app-subtle relative">
            {!proxyEnabled && (
                <div className="absolute inset-0 flex items-center justify-center z-10
                    bg-app-main/60 text-app-muted text-xs font-medium">
                    Proxy Stopped
                </div>
            )}
            <div className={`flex items-center justify-center gap-1 ${!proxyEnabled ? 'opacity-30' : ''}`}>
                {STAGES.map((stage, i) => (
                    <div key={stage.id} className="flex items-center gap-1">
                        <div
                            className={`
                                rounded-lg border px-3 py-2 text-xs text-center min-w-[80px]
                                transition-colors duration-150 relative
                                ${active[stage.id]
                                    ? 'bg-blue-500/30 border-blue-500 text-app-inverse'
                                    : 'border-app-subtle text-app-muted'}
                                ${proxyEnabled && !active[stage.id] && stage.id === 'incoming'
                                    ? 'animate-pulse' : ''}
                            `}
                        >
                            {stage.label}
                            {(counters[stage.id] ?? 0) > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 text-[10px]
                                    bg-app-subtle text-app-muted rounded-full px-1 leading-tight">
                                    {counters[stage.id]}
                                </span>
                            )}
                        </div>
                        {i < STAGES.length - 1 && (
                            <span className="text-app-muted text-xs select-none">&rarr;</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

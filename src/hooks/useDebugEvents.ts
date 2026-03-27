import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { InterceptRequestSplitPayload, InterceptResponseSplitPayload } from '@/types/intercept'
import { useDebugStore, type DebugInternalEvent, type DebugTrafficEvent } from '@/stores/debugStore'
import { INTERCEPT_FLUSH_INTERVAL_MS } from '@/lib/constants'

interface DebugInternalPayload {
    timestamp: number;
    level: 'info' | 'warn' | 'error';
    source: string;
    message: string;
}

interface DebugEventBuffer {
    internal: DebugInternalEvent[];
    traffic: { type: 'add'; event: DebugTrafficEvent }[];
    trafficUpdates: { id: string; status: number; durationMs: number }[];
}

function createBuffer(): DebugEventBuffer {
    return { internal: [], traffic: [], trafficUpdates: [] }
}

export function useDebugEvents(): void {
    const unlistenRefs = useRef<UnlistenFn[]>([])
    const bufferRef = useRef<DebugEventBuffer>(createBuffer())

    // Flush buffered debug events on an interval — same cadence as intercept events.
    useEffect(() => {
        const intervalId = setInterval(() => {
            const buf = bufferRef.current
            if (buf.internal.length === 0 && buf.traffic.length === 0 && buf.trafficUpdates.length === 0) return

            const internal = buf.internal
            const traffic = buf.traffic
            const trafficUpdates = buf.trafficUpdates
            bufferRef.current = createBuffer()

            // Batch internal events
            if (internal.length > 0) {
                useDebugStore.setState((state) => {
                    const events = [...state.internalEvents, ...internal]
                    return {
                        internalEvents: events.length > 1000 ? events.slice(events.length - 1000) : events,
                    }
                })
            }

            // Batch traffic events
            if (traffic.length > 0 || trafficUpdates.length > 0) {
                useDebugStore.setState((state) => {
                    let events = [...state.trafficEvents]
                    for (const t of traffic) {
                        events.push(t.event)
                    }
                    for (const u of trafficUpdates) {
                        const idx = events.findIndex((e) => e.id === u.id)
                        if (idx !== -1) {
                            events[idx] = { ...events[idx], status: u.status, durationMs: u.durationMs }
                        }
                    }
                    if (events.length > 1000) {
                        events = events.slice(events.length - 1000)
                    }
                    return { trafficEvents: events }
                })
            }
        }, INTERCEPT_FLUSH_INTERVAL_MS)

        return () => clearInterval(intervalId)
    }, [])

    useEffect(() => {
        let cancelled = false
        const refs = unlistenRefs.current

        // Internal Rust events — buffer instead of immediate store update
        listen<DebugInternalPayload>('debug:internal-event', (event) => {
            bufferRef.current.internal.push({
                id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                ...event.payload,
            })
        })
            .then((fn) => { if (cancelled) fn(); else refs.push(fn) })
            .catch((err) => console.error('[useDebugEvents] internal-event listener failed:', err))

        // Proxy traffic — request side
        listen<InterceptRequestSplitPayload>('intercept:request-split', (event) => {
            const p = event.payload
            bufferRef.current.traffic.push({
                type: 'add',
                event: {
                    id: p.id,
                    timestamp: p.timestamp,
                    method: p.method,
                    url: `${p.host}${p.path}`,
                    status: null,
                    durationMs: null,
                },
            })
        })
            .then((fn) => { if (cancelled) fn(); else refs.push(fn) })
            .catch((err) => console.error('[useDebugEvents] request-split listener failed:', err))

        // Proxy traffic — response side
        listen<InterceptResponseSplitPayload>('intercept:response-split', (event) => {
            const p = event.payload
            bufferRef.current.trafficUpdates.push({
                id: p.id,
                status: p.statusCode,
                durationMs: p.responseTimeMs,
            })
        })
            .then((fn) => { if (cancelled) fn(); else refs.push(fn) })
            .catch((err) => console.error('[useDebugEvents] response-split listener failed:', err))

        return () => {
            cancelled = true
            refs.forEach((fn) => fn())
            refs.length = 0
        }
    }, [])
}

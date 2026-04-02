import { useEffect, useRef, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { InterceptRequestSplitPayload, InterceptResponseSplitPayload } from '@/types/intercept'
import { useDebugStore, type DebugInternalEvent, type DebugTrafficEvent } from '@/stores/debugStore'
import { useEventBuffer } from '@/hooks/useEventBuffer'
import { INTERCEPT_FLUSH_INTERVAL_MS } from '@/lib/constants'

interface DebugInternalPayload {
    timestamp: number;
    level: 'info' | 'warn' | 'error';
    source: string;
    message: string;
}

type DebugBufferItem =
    | { kind: 'internal'; event: DebugInternalEvent }
    | { kind: 'traffic'; event: DebugTrafficEvent }
    | { kind: 'trafficUpdate'; update: { id: string; status: number; durationMs: number } }

export function useDebugEvents(): void {
    const unlistenRefs = useRef<UnlistenFn[]>([])

    const handleFlush = useCallback((items: DebugBufferItem[]) => {
        const internal: DebugInternalEvent[] = []
        const traffic: DebugTrafficEvent[] = []
        const updates: { id: string; status: number; durationMs: number }[] = []

        for (const item of items) {
            if (item.kind === 'internal') internal.push(item.event)
            else if (item.kind === 'traffic') traffic.push(item.event)
            else updates.push(item.update)
        }

        if (internal.length > 0) {
            useDebugStore.setState((state) => {
                const events = [...state.internalEvents, ...internal]
                return {
                    internalEvents: events.length > 1000 ? events.slice(events.length - 1000) : events,
                }
            })
        }

        if (traffic.length > 0 || updates.length > 0) {
            useDebugStore.setState((state) => {
                let events = [...state.trafficEvents]
                for (const t of traffic) events.push(t)
                for (const u of updates) {
                    const idx = events.findIndex((e) => e.id === u.id)
                    if (idx !== -1) {
                        events[idx] = { ...events[idx], status: u.status, durationMs: u.durationMs }
                    }
                }
                if (events.length > 1000) events = events.slice(events.length - 1000)
                return { trafficEvents: events }
            })
        }
    }, [])

    const { push } = useEventBuffer<DebugBufferItem>(INTERCEPT_FLUSH_INTERVAL_MS, handleFlush)

    useEffect(() => {
        let cancelled = false
        const refs = unlistenRefs.current

        // Internal Rust events — buffer instead of immediate store update
        listen<DebugInternalPayload>('debug:internal-event', (event) => {
            push({
                kind: 'internal',
                event: {
                    id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    ...event.payload,
                },
            })
        })
            .then((fn) => { if (cancelled) fn(); else refs.push(fn) })
            .catch((err) => console.error('[useDebugEvents] internal-event listener failed:', err))

        // Proxy traffic — request side
        listen<InterceptRequestSplitPayload>('intercept:request-split', (event) => {
            const p = event.payload
            push({
                kind: 'traffic',
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
            push({
                kind: 'trafficUpdate',
                update: {
                    id: p.id,
                    status: p.statusCode,
                    durationMs: p.responseTimeMs,
                },
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

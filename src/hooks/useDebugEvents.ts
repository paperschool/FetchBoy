import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { InterceptRequestSplitPayload, InterceptResponseSplitPayload } from '@/types/intercept'
import { useDebugStore } from '@/stores/debugStore'

interface DebugInternalPayload {
    timestamp: number;
    level: 'info' | 'warn' | 'error';
    source: string;
    message: string;
}

export function useDebugEvents(): void {
    const unlistenRefs = useRef<UnlistenFn[]>([])

    useEffect(() => {
        let cancelled = false
        const refs = unlistenRefs.current

        // Internal Rust events
        listen<DebugInternalPayload>('debug:internal-event', (event) => {
            useDebugStore.getState().addInternalEvent({
                id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                ...event.payload,
            })
        })
            .then((fn) => { if (cancelled) fn(); else refs.push(fn) })
            .catch((err) => console.error('[useDebugEvents] internal-event listener failed:', err))

        // Proxy traffic — request side
        listen<InterceptRequestSplitPayload>('intercept:request-split', (event) => {
            const p = event.payload
            useDebugStore.getState().addTrafficEvent({
                id: p.id,
                timestamp: p.timestamp,
                method: p.method,
                url: `${p.host}${p.path}`,
                status: null,
                durationMs: null,
            })
        })
            .then((fn) => { if (cancelled) fn(); else refs.push(fn) })
            .catch((err) => console.error('[useDebugEvents] request-split listener failed:', err))

        // Proxy traffic — response side
        listen<InterceptResponseSplitPayload>('intercept:response-split', (event) => {
            const p = event.payload
            useDebugStore.getState().updateTrafficEvent(p.id, p.statusCode, p.responseTimeMs)
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

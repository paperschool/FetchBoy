import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { MappingAppliedPayload, BreakpointPausedPayload } from '@/types/intercept';
import { useMappingLogStore, type MappingLogEntry } from '@/stores/mappingLogStore';
import { INTERCEPT_FLUSH_INTERVAL_MS } from '@/lib/constants';

export function useMappingLogEvents(): void {
    const unlistenMapRef = useRef<UnlistenFn | undefined>(undefined);
    const unlistenBpRef = useRef<UnlistenFn | undefined>(undefined);
    const bufferRef = useRef<MappingLogEntry[]>([]);

    // Flush buffered mapping log entries on interval.
    useEffect(() => {
        const intervalId = setInterval(() => {
            const entries = bufferRef.current;
            if (entries.length === 0) return;
            bufferRef.current = [];

            // Add all buffered entries in one batch.
            const store = useMappingLogStore.getState();
            for (const entry of entries) {
                store.addEntry(entry);
            }
        }, INTERCEPT_FLUSH_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        let cancelled = false;

        listen<MappingAppliedPayload>('mapping:applied', (event) => {
            const p = event.payload;
            bufferRef.current.push({
                id: crypto.randomUUID(),
                timestamp: p.timestamp,
                method: '',
                url: p.requestId,
                mappingId: p.mappingId,
                mappingName: p.mappingName,
                overridesApplied: p.overridesApplied,
                originalUrl: p.originalUrl,
                remappedUrl: p.remappedUrl,
                source: 'mapping',
            });
        })
            .then((fn) => { if (cancelled) fn(); else unlistenMapRef.current = fn; })
            .catch((err) => console.error('[useMappingLogEvents] mapping listener failed:', err));

        // Breakpoint paused events are rare — still buffer for consistency.
        listen<BreakpointPausedPayload>('breakpoint:paused', (event) => {
            const p = event.payload;
            const overrides: string[] = ['paused'];
            if (p.statusCode) overrides.push('status_code');
            bufferRef.current.push({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                method: p.method,
                url: `${p.host}${p.path}`,
                mappingId: p.breakpointId,
                mappingName: p.breakpointName,
                overridesApplied: overrides,
                source: 'breakpoint',
            });
        })
            .then((fn) => { if (cancelled) fn(); else unlistenBpRef.current = fn; })
            .catch((err) => console.error('[useMappingLogEvents] breakpoint listener failed:', err));

        return () => {
            cancelled = true;
            unlistenMapRef.current?.();
            unlistenBpRef.current?.();
        };
    }, []);
}

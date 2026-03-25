import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { MappingAppliedPayload, BreakpointPausedPayload } from '@/types/intercept';
import { useMappingLogStore } from '@/stores/mappingLogStore';

export function useMappingLogEvents(): void {
    const unlistenMapRef = useRef<UnlistenFn | undefined>(undefined);
    const unlistenBpRef = useRef<UnlistenFn | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;

        // Listen for mapping:applied events
        listen<MappingAppliedPayload>('mapping:applied', (event) => {
            const p = event.payload;
            useMappingLogStore.getState().addEntry({
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

        // Listen for breakpoint:paused events (breakpoints are also overrides)
        listen<BreakpointPausedPayload>('breakpoint:paused', (event) => {
            const p = event.payload;
            const overrides: string[] = ['paused'];
            if (p.statusCode) overrides.push('status_code');
            useMappingLogStore.getState().addEntry({
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

import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { MappingAppliedPayload } from '@/types/intercept';
import { useMappingLogStore } from '@/stores/mappingLogStore';

export function useMappingLogEvents(): void {
    const unlistenRef = useRef<UnlistenFn | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;

        listen<MappingAppliedPayload>('mapping:applied', (event) => {
            const p = event.payload;
            useMappingLogStore.getState().addEntry({
                id: crypto.randomUUID(),
                timestamp: p.timestamp,
                method: '',  // not included in event; filled by intercept table if needed
                url: p.requestId,
                mappingId: p.mappingId,
                mappingName: p.mappingName,
                overridesApplied: p.overridesApplied,
                originalUrl: p.originalUrl,
                remappedUrl: p.remappedUrl,
            });
        })
            .then((fn) => {
                if (cancelled) fn();
                else unlistenRef.current = fn;
            })
            .catch((err) => {
                console.error('[useMappingLogEvents] Failed to register listener:', err);
            });

        return () => {
            cancelled = true;
            if (unlistenRef.current) {
                unlistenRef.current();
                unlistenRef.current = undefined;
            }
        };
    }, []);
}

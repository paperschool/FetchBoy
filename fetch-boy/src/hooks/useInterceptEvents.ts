import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { InterceptEventPayload } from '@/types/intercept'
import { useInterceptStore } from '@/stores/interceptStore'

export function useInterceptEvents(): void {
  const unlistenRef = useRef<UnlistenFn | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    listen<InterceptEventPayload>('intercept:request', (event) => {
      useInterceptStore.getState().addRequest(event.payload)
    })
      .then((fn) => {
        if (cancelled) {
          fn()
        } else {
          unlistenRef.current = fn
        }
      })
      .catch((err) => {
        console.error('[useInterceptEvents] Failed to register listener:', err)
      })

    return () => {
      cancelled = true
      if (unlistenRef.current) {
        unlistenRef.current()
        unlistenRef.current = undefined
      }
    }
  }, [])
}

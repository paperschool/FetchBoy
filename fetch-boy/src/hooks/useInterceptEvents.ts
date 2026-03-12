import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { InterceptEventPayload } from '@/types/intercept'
import { useInterceptStore } from '@/stores/interceptStore'

export function useInterceptEvents(): void {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined

    listen<InterceptEventPayload>('intercept:request', (event) => {
      useInterceptStore.getState().addRequest(event.payload)
    })
      .then((fn) => {
        unlisten = fn
      })
      .catch((err) => {
        console.error('[useInterceptEvents] Failed to register listener:', err)
      })

    return () => {
      unlisten?.()
    }
  }, []) // empty dep array — register once on mount
}

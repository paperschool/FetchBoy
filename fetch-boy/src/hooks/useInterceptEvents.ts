import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { InterceptEventPayload, BreakpointPausedPayload } from '@/types/intercept'
import { useInterceptStore } from '@/stores/interceptStore'

export function useInterceptEvents(): void {
  const unlistenRef = useRef<UnlistenFn | undefined>(undefined)
  const unlistenPausedRef = useRef<UnlistenFn | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    // Listen for completed intercept requests.
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
        console.error('[useInterceptEvents] Failed to register intercept listener:', err)
      })

    // Listen for breakpoint-paused events.
    listen<BreakpointPausedPayload>('breakpoint:paused', (event) => {
      const p = event.payload
      const store = useInterceptStore.getState()

      // Build a synthetic InterceptRequest from the paused event data.
      const request = {
        id: p.requestId,
        timestamp: Date.now(),
        method: p.method,
        host: p.host,
        path: p.path,
        statusCode: p.statusCode,
        contentType: p.responseHeaders?.['content-type'],
        size: p.responseBody ? p.responseBody.length : undefined,
        responseBody: p.responseBody,
        requestHeaders: p.requestHeaders,
        requestBody: p.requestBody,
        responseHeaders: p.responseHeaders,
        isPaused: true,
      }

      store.pauseAtBreakpoint(request, p.breakpointId, p.breakpointName, p.timeoutAt)
    })
      .then((fn) => {
        if (cancelled) {
          fn()
        } else {
          unlistenPausedRef.current = fn
        }
      })
      .catch((err) => {
        console.error('[useInterceptEvents] Failed to register pause listener:', err)
      })

    return () => {
      cancelled = true
      if (unlistenRef.current) {
        unlistenRef.current()
        unlistenRef.current = undefined
      }
      if (unlistenPausedRef.current) {
        unlistenPausedRef.current()
        unlistenPausedRef.current = undefined
      }
    }
  }, [])
}

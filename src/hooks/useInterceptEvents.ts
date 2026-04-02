import { useCallback } from 'react'
import type { BreakpointPausedPayload, InterceptRequestSplitPayload, InterceptResponseSplitPayload } from '@/types/intercept'
import { useInterceptStore } from '@/stores/interceptStore'
import { useTauriListener } from '@/hooks/useTauriListener'
import { useEventBuffer } from '@/hooks/useEventBuffer'
import { INTERCEPT_FLUSH_INTERVAL_MS } from '@/lib/constants'

type InterceptBufferItem =
  | { kind: 'request'; payload: InterceptRequestSplitPayload }
  | { kind: 'response'; payload: InterceptResponseSplitPayload }

export function useInterceptEvents(): void {
  const handleFlush = useCallback((items: InterceptBufferItem[]) => {
    const pending: InterceptRequestSplitPayload[] = []
    const responses: InterceptResponseSplitPayload[] = []
    for (const item of items) {
      if (item.kind === 'request') pending.push(item.payload)
      else responses.push(item.payload)
    }

    useInterceptStore.setState((state) => {
      let requests = [...state.requests]

      for (const p of pending) {
        if (requests.some((r) => r.id === p.id)) continue
        requests.push({
          id: p.id,
          timestamp: p.timestamp,
          method: p.method,
          host: p.host,
          path: p.path,
          requestHeaders: p.requestHeaders,
          requestBody: p.requestBody,
          isPending: true,
        })
      }

      for (const r of responses) {
        const idx = requests.findIndex((req) => req.id === r.id)
        if (idx === -1) continue
        requests[idx] = {
          ...requests[idx],
          statusCode: r.statusCode,
          responseHeaders: r.responseHeaders,
          responseBody: r.responseBody,
          contentType: r.contentType,
          size: r.size,
          isBlocked: r.isBlocked,
          isPending: false,
        }
      }

      const max = 5000
      if (requests.length > max) {
        requests = requests.slice(requests.length - max)
      }

      return { requests }
    })
  }, [])

  const { push } = useEventBuffer<InterceptBufferItem>(INTERCEPT_FLUSH_INTERVAL_MS, handleFlush)

  const handleRequestSplit = useCallback((payload: InterceptRequestSplitPayload) => {
    push({ kind: 'request', payload })
  }, [push])

  const handleResponseSplit = useCallback((payload: InterceptResponseSplitPayload) => {
    push({ kind: 'response', payload })
  }, [push])

  // Breakpoint paused events are rare and need immediate UI response — no buffering.
  const handleBreakpointPaused = useCallback((p: BreakpointPausedPayload) => {
    const store = useInterceptStore.getState()
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
  }, [])

  useTauriListener<InterceptRequestSplitPayload>('intercept:request-split', handleRequestSplit)
  useTauriListener<InterceptResponseSplitPayload>('intercept:response-split', handleResponseSplit)
  useTauriListener<BreakpointPausedPayload>('breakpoint:paused', handleBreakpointPaused)
}

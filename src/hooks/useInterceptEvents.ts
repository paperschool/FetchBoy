import { useCallback, useEffect, useRef } from 'react'
import type { BreakpointPausedPayload, InterceptRequestSplitPayload, InterceptResponseSplitPayload } from '@/types/intercept'
import { useInterceptStore } from '@/stores/interceptStore'
import { useTauriListener } from '@/hooks/useTauriListener'
import { INTERCEPT_FLUSH_INTERVAL_MS } from '@/lib/constants'

// Buffered events — accumulated between flushes to batch store updates.
interface EventBuffer {
  pending: InterceptRequestSplitPayload[]
  responses: InterceptResponseSplitPayload[]
}

function createBuffer(): EventBuffer {
  return { pending: [], responses: [] }
}

export function useInterceptEvents(): void {
  const bufferRef = useRef<EventBuffer>(createBuffer())

  // Flush buffered events into the store in a single batch.
  useEffect(() => {
    const intervalId = setInterval(() => {
      const buf = bufferRef.current
      if (buf.pending.length === 0 && buf.responses.length === 0) return

      const pending = buf.pending
      const responses = buf.responses
      bufferRef.current = createBuffer()

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
    }, INTERCEPT_FLUSH_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [])

  // Event handlers just push into the buffer — no store update.
  const handleRequestSplit = useCallback((payload: InterceptRequestSplitPayload) => {
    bufferRef.current.pending.push(payload)
  }, [])

  const handleResponseSplit = useCallback((payload: InterceptResponseSplitPayload) => {
    bufferRef.current.responses.push(payload)
  }, [])

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

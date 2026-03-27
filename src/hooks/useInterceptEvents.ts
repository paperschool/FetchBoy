import { useCallback } from 'react'
import type { InterceptEventPayload, BreakpointPausedPayload, InterceptRequestSplitPayload, InterceptResponseSplitPayload } from '@/types/intercept'
import { useInterceptStore } from '@/stores/interceptStore'
import { useTauriListener } from '@/hooks/useTauriListener'

export function useInterceptEvents(): void {
  const handleRequestSplit = useCallback((payload: InterceptRequestSplitPayload) => {
    useInterceptStore.getState().addPendingRequest(payload)
  }, [])

  const handleResponseSplit = useCallback((payload: InterceptResponseSplitPayload) => {
    useInterceptStore.getState().updateWithResponse(payload)
  }, [])

  const handleInterceptRequest = useCallback((payload: InterceptEventPayload) => {
    useInterceptStore.getState().addRequest(payload)
  }, [])

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
  useTauriListener<InterceptEventPayload>('intercept:request', handleInterceptRequest)
  useTauriListener<BreakpointPausedPayload>('breakpoint:paused', handleBreakpointPaused)
}

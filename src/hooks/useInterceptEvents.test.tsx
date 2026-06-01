import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useInterceptEvents } from './useInterceptEvents'
import { useInterceptStore } from '@/stores/interceptStore'
import { INTERCEPT_FLUSH_INTERVAL_MS } from '@/lib/constants'

// Mock the Tauri event module
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

// Mock the Tauri core module (used by interceptStore actions)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

import { listen } from '@tauri-apps/api/event'

function TestHost() {
  useInterceptEvents()
  return null
}

describe('useInterceptEvents', () => {
  beforeEach(() => {
    useInterceptStore.setState({ requests: [], pauseState: 'idle', pausedRequest: null })
    vi.clearAllMocks()
  })

  it('calls listen with intercept:request-split on mount', async () => {
    const mockUnlisten = vi.fn()
    vi.mocked(listen).mockResolvedValue(mockUnlisten)

    render(<TestHost />)

    expect(listen).toHaveBeenCalledWith('intercept:request-split', expect.any(Function))
  })

  it('also calls listen with breakpoint:paused on mount', async () => {
    const mockUnlisten = vi.fn()
    vi.mocked(listen).mockResolvedValue(mockUnlisten)

    render(<TestHost />)

    expect(listen).toHaveBeenCalledWith('breakpoint:paused', expect.any(Function))
  })

  it('adds request to store when intercept:request-split event is received', async () => {
    vi.useFakeTimers()
    try {
      const mockUnlisten = vi.fn()
      const handlers: Record<string, ((event: { payload: unknown }) => void)> = {}

      vi.mocked(listen).mockImplementation((eventName, handler) => {
        handlers[eventName as string] = handler as (event: { payload: unknown }) => void
        return Promise.resolve(mockUnlisten)
      })

      render(<TestHost />)

      const payload = {
        id: 'test-1',
        timestamp: 1234567890,
        method: 'GET',
        host: 'example.com',
        path: '/api/data',
        requestHeaders: { accept: 'application/json' },
      }
      // Events are buffered and flushed on an interval; push then advance past the flush.
      handlers['intercept:request-split']({ payload })
      await vi.advanceTimersByTimeAsync(INTERCEPT_FLUSH_INTERVAL_MS + 1)

      expect(useInterceptStore.getState().requests).toHaveLength(1)
      expect(useInterceptStore.getState().requests[0].id).toBe('test-1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('calls unlisten for all listeners on unmount', async () => {
    const mockUnlisten = vi.fn()
    vi.mocked(listen).mockResolvedValue(mockUnlisten)

    const { unmount } = render(<TestHost />)
    await vi.waitFor(() => expect(listen).toHaveBeenCalled())
    // Wait for promises to resolve so unlisten functions are stored
    await new Promise((resolve) => setTimeout(resolve, 0))

    unmount()

    // Three listeners registered: intercept:request-split, intercept:response-split, breakpoint:paused
    expect(mockUnlisten).toHaveBeenCalledTimes(3)
  })
})

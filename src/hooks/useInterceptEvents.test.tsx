import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useInterceptEvents } from './useInterceptEvents'
import { useInterceptStore } from '@/stores/interceptStore'

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

  it('calls listen with intercept:request on mount', async () => {
    const mockUnlisten = vi.fn()
    vi.mocked(listen).mockResolvedValue(mockUnlisten)

    render(<TestHost />)

    expect(listen).toHaveBeenCalledWith('intercept:request', expect.any(Function))
  })

  it('also calls listen with breakpoint:paused on mount', async () => {
    const mockUnlisten = vi.fn()
    vi.mocked(listen).mockResolvedValue(mockUnlisten)

    render(<TestHost />)

    expect(listen).toHaveBeenCalledWith('breakpoint:paused', expect.any(Function))
  })

  it('adds request to store when intercept:request event is received', async () => {
    const mockUnlisten = vi.fn()
    const handlers: Record<string, ((event: { payload: unknown }) => void)> = {}

    vi.mocked(listen).mockImplementation((eventName, handler) => {
      handlers[eventName as string] = handler as (event: { payload: unknown }) => void
      return Promise.resolve(mockUnlisten)
    })

    render(<TestHost />)
    await vi.waitFor(() => Object.keys(handlers).includes('intercept:request'))

    const payload = {
      id: 'test-1',
      timestamp: 1234567890,
      method: 'GET',
      host: 'example.com',
      path: '/api/data',
      statusCode: 200,
      contentType: 'application/json',
      size: 512,
    }
    handlers['intercept:request']({ payload })

    expect(useInterceptStore.getState().requests).toHaveLength(1)
    expect(useInterceptStore.getState().requests[0].id).toBe('test-1')
  })

  it('calls unlisten for all listeners on unmount', async () => {
    const mockUnlisten = vi.fn()
    vi.mocked(listen).mockResolvedValue(mockUnlisten)

    const { unmount } = render(<TestHost />)
    await vi.waitFor(() => expect(listen).toHaveBeenCalled())
    // Wait for promises to resolve so unlisten functions are stored
    await new Promise((resolve) => setTimeout(resolve, 0))

    unmount()

    // Two listeners registered (intercept:request + breakpoint:paused)
    expect(mockUnlisten).toHaveBeenCalledTimes(2)
  })
})

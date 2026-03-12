import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useInterceptEvents } from './useInterceptEvents'
import { useInterceptStore } from '@/stores/interceptStore'

// Mock the Tauri event module
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

import { listen } from '@tauri-apps/api/event'

function TestHost() {
  useInterceptEvents()
  return null
}

describe('useInterceptEvents', () => {
  beforeEach(() => {
    useInterceptStore.setState({ requests: [] })
    vi.clearAllMocks()
  })

  it('calls listen with intercept:request on mount', async () => {
    const mockUnlisten = vi.fn()
    vi.mocked(listen).mockResolvedValue(mockUnlisten)

    render(<TestHost />)

    expect(listen).toHaveBeenCalledWith('intercept:request', expect.any(Function))
  })

  it('adds request to store when event is received', async () => {
    const mockUnlisten = vi.fn()
    let capturedHandler: ((event: { payload: unknown }) => void) | undefined

    vi.mocked(listen).mockImplementation((_eventName, handler) => {
      capturedHandler = handler as typeof capturedHandler
      return Promise.resolve(mockUnlisten)
    })

    render(<TestHost />)
    await vi.waitFor(() => capturedHandler !== undefined)

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
    capturedHandler!({ payload })

    expect(useInterceptStore.getState().requests).toHaveLength(1)
    expect(useInterceptStore.getState().requests[0].id).toBe('test-1')
  })

  it('calls unlisten on unmount', async () => {
    const mockUnlisten = vi.fn()
    vi.mocked(listen).mockResolvedValue(mockUnlisten)

    const { unmount } = render(<TestHost />)
    await vi.waitFor(() => expect(listen).toHaveBeenCalled())
    // Wait for promise to resolve so unlisten is stored
    await new Promise((resolve) => setTimeout(resolve, 0))

    unmount()

    expect(mockUnlisten).toHaveBeenCalledTimes(1)
  })
})

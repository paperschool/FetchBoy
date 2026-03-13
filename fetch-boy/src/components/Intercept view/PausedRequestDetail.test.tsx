import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PausedRequestDetail } from './PausedRequestDetail'
import { useInterceptStore } from '@/stores/interceptStore'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

const PAUSED_REQUEST = {
  id: 'req-pause-1',
  timestamp: Date.now(),
  method: 'POST',
  host: 'api.example.com',
  path: '/orders',
  statusCode: 200,
  responseBody: '{"ok":true}',
  isPaused: true,
}

function setupPausedState() {
  useInterceptStore.getState().pauseAtBreakpoint(
    PAUSED_REQUEST,
    'bp-1',
    'Order Breakpoint',
    Math.floor(Date.now() / 1000) + 30,
  )
}

beforeEach(() => {
  useInterceptStore.setState({
    pauseState: 'idle',
    pausedRequest: null,
    requests: [],
    selectedRequestId: null,
    editMode: false,
    pendingMods: {},
  })
})

describe('PausedRequestDetail', () => {
  it('renders nothing when pauseState is idle', () => {
    const { container } = render(<PausedRequestDetail />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the paused UI when a request is paused', () => {
    setupPausedState()
    render(<PausedRequestDetail />)
    expect(screen.getByTestId('paused-request-detail')).toBeInTheDocument()
  })

  it('opens in edit mode by default when breakpoint is hit', () => {
    setupPausedState()
    render(<PausedRequestDetail />)
    // In edit mode the slim bar is shown — no "Continue with Edits" button
    expect(screen.queryByText('Continue with Edits')).toBeNull()
    expect(screen.getByText('Continue')).toBeInTheDocument()
    expect(screen.getByText('Drop')).toBeInTheDocument()
  })

  it('shows a countdown timer when timeoutAt is in the future', () => {
    setupPausedState()
    render(<PausedRequestDetail />)
    // edit mode bar doesn't show timer — switch to non-edit mode to test timer
    useInterceptStore.setState({ editMode: false })
    const { unmount } = render(<PausedRequestDetail />)
    expect(screen.getAllByTestId('countdown-timer')[0]).toBeInTheDocument()
    unmount()
  })

  it('shows Continue with Edits in non-edit mode', () => {
    setupPausedState()
    useInterceptStore.setState({ editMode: false })
    render(<PausedRequestDetail />)
    expect(screen.getByText('Continue with Edits')).toBeInTheDocument()
  })

  it('calls editAndResume when Continue clicked in edit mode', () => {
    const editAndResumeMock = vi.fn().mockResolvedValue(undefined)
    useInterceptStore.setState({ editAndResume: editAndResumeMock } as Partial<ReturnType<typeof useInterceptStore.getState>>)
    setupPausedState()
    render(<PausedRequestDetail />)
    fireEvent.click(screen.getByText('Continue'))
    expect(editAndResumeMock).toHaveBeenCalledOnce()
  })

  it('calls dropRequest when Drop clicked', () => {
    const dropMock = vi.fn().mockResolvedValue(undefined)
    useInterceptStore.setState({ dropRequest: dropMock } as Partial<ReturnType<typeof useInterceptStore.getState>>)
    setupPausedState()
    render(<PausedRequestDetail />)
    fireEvent.click(screen.getByText('Drop'))
    expect(dropMock).toHaveBeenCalledOnce()
  })

  it('calls continueRequest when Continue clicked in non-edit mode', () => {
    const continueMock = vi.fn().mockResolvedValue(undefined)
    useInterceptStore.setState({ continueRequest: continueMock } as Partial<ReturnType<typeof useInterceptStore.getState>>)
    setupPausedState()
    useInterceptStore.setState({ editMode: false })
    render(<PausedRequestDetail />)
    fireEvent.click(screen.getByText('Continue'))
    expect(continueMock).toHaveBeenCalledOnce()
  })

  it('calls enterEditMode when Continue with Edits clicked in non-edit mode', () => {
    const enterEditModeMock = vi.fn()
    useInterceptStore.setState({ enterEditMode: enterEditModeMock } as Partial<ReturnType<typeof useInterceptStore.getState>>)
    setupPausedState()
    useInterceptStore.setState({ editMode: false })
    render(<PausedRequestDetail />)
    fireEvent.click(screen.getByText('Continue with Edits'))
    expect(enterEditModeMock).toHaveBeenCalledOnce()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PausedRequestDetail } from './PausedRequestDetail'
import { useInterceptStore } from '@/stores/interceptStore'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

// Monaco editor is not needed in tests
vi.mock('@/components/Editor/MonacoEditorField', () => ({
  MonacoEditorField: ({ value }: { value: string }) => (
    <textarea data-testid="monaco-mock" defaultValue={value} />
  ),
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
    expect(screen.getByText('Request Paused at Breakpoint')).toBeInTheDocument()
  })

  it('shows the breakpoint name', () => {
    setupPausedState()
    render(<PausedRequestDetail />)
    expect(screen.getByText('Order Breakpoint')).toBeInTheDocument()
  })

  it('shows a countdown timer when timeoutAt is in the future', () => {
    setupPausedState()
    render(<PausedRequestDetail />)
    expect(screen.getByTestId('countdown-timer')).toBeInTheDocument()
    expect(screen.getByTestId('countdown-timer').textContent).toMatch(/\d+s remaining/)
  })

  it('shows Continue, Drop and Edit & Continue buttons', () => {
    setupPausedState()
    render(<PausedRequestDetail />)
    expect(screen.getByText('Continue')).toBeInTheDocument()
    expect(screen.getByText('Drop')).toBeInTheDocument()
    expect(screen.getByText('Edit & Continue')).toBeInTheDocument()
  })

  it('calls continueRequest when Continue clicked', () => {
    const continueMock = vi.fn().mockResolvedValue(undefined)
    useInterceptStore.setState({ continueRequest: continueMock } as Partial<ReturnType<typeof useInterceptStore.getState>>)
    setupPausedState()
    render(<PausedRequestDetail />)
    fireEvent.click(screen.getByText('Continue'))
    expect(continueMock).toHaveBeenCalledOnce()
  })

  it('calls dropRequest when Drop clicked', () => {
    const dropMock = vi.fn().mockResolvedValue(undefined)
    useInterceptStore.setState({ dropRequest: dropMock } as Partial<ReturnType<typeof useInterceptStore.getState>>)
    setupPausedState()
    render(<PausedRequestDetail />)
    fireEvent.click(screen.getByText('Drop'))
    expect(dropMock).toHaveBeenCalledOnce()
  })

  it('opens RequestEditDialog when Edit & Continue clicked', () => {
    setupPausedState()
    render(<PausedRequestDetail />)
    fireEvent.click(screen.getByText('Edit & Continue'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows request method and host', () => {
    setupPausedState()
    render(<PausedRequestDetail />)
    expect(screen.getByText(/POST/)).toBeInTheDocument()
    expect(screen.getByText(/api\.example\.com/)).toBeInTheDocument()
  })
})

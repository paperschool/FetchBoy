import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BreakpointActionPanel } from './BreakpointActionPanel'
import { useInterceptStore } from '@/stores/interceptStore'

// Mock the invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

const BREAKPOINT_ID = 'bp-test-1'

function setupPausedState() {
  const state = useInterceptStore.getState()
  state.pauseAtBreakpoint(
    {
      id: 'req-1',
      timestamp: Date.now(),
      method: 'GET',
      host: 'api.example.com',
      path: '/users',
      isPaused: true,
    },
    BREAKPOINT_ID,
    'Test Breakpoint',
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

describe('BreakpointActionPanel', () => {
  it('renders nothing when no request is paused', () => {
    const { container } = render(<BreakpointActionPanel breakpointId={BREAKPOINT_ID} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when a different breakpoint is paused', () => {
    setupPausedState()
    const { container } = render(<BreakpointActionPanel breakpointId="other-bp" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows paused state when request is paused for this breakpoint', () => {
    setupPausedState()
    render(<BreakpointActionPanel breakpointId={BREAKPOINT_ID} />)
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('renders Continue, Drop and Continue with Edits buttons when paused', () => {
    setupPausedState()
    render(<BreakpointActionPanel breakpointId={BREAKPOINT_ID} />)
    expect(screen.getByTitle('Continue')).toBeInTheDocument()
    expect(screen.getByTitle('Drop')).toBeInTheDocument()
    expect(screen.getByTitle('Continue with Edits')).toBeInTheDocument()
  })

  it('calls enterEditMode when Continue with Edits button clicked', () => {
    const enterEditModeMock = vi.fn()
    useInterceptStore.setState({ enterEditMode: enterEditModeMock } as Partial<ReturnType<typeof useInterceptStore.getState>>)
    setupPausedState()
    render(<BreakpointActionPanel breakpointId={BREAKPOINT_ID} />)
    fireEvent.click(screen.getByTitle('Continue with Edits'))
    expect(enterEditModeMock).toHaveBeenCalledOnce()
  })

  it('calls continueRequest when Continue button clicked', async () => {
    const continueMock = vi.fn().mockResolvedValue(undefined)
    useInterceptStore.setState({ continueRequest: continueMock } as Partial<ReturnType<typeof useInterceptStore.getState>>)
    setupPausedState()
    render(<BreakpointActionPanel breakpointId={BREAKPOINT_ID} />)
    fireEvent.click(screen.getByTitle('Continue'))
    expect(continueMock).toHaveBeenCalledOnce()
  })

  it('calls dropRequest when Drop button clicked', async () => {
    const dropMock = vi.fn().mockResolvedValue(undefined)
    useInterceptStore.setState({ dropRequest: dropMock } as Partial<ReturnType<typeof useInterceptStore.getState>>)
    setupPausedState()
    render(<BreakpointActionPanel breakpointId={BREAKPOINT_ID} />)
    fireEvent.click(screen.getByTitle('Drop'))
    expect(dropMock).toHaveBeenCalledOnce()
  })
})

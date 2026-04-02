import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InterceptTable } from './InterceptTable'
import { InterceptView } from './InterceptView'
import { useInterceptStore } from '@/stores/interceptStore'
import type { InterceptRequest } from '@/stores/interceptStore'
import {
  formatTimestamp,
  formatHostPath,
  formatContentType,
  formatSize,
  filterRequests,
} from './InterceptTable.utils'

// Mock the virtualizer - returns mock virtual items based on count
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, i) => ({
      index: i,
      size: 40,
      start: i * 40
    })),
    getTotalSize: () => count * 40,
  })),
}))

const sampleRequests: InterceptRequest[] = [
  {
    id: '1',
    timestamp: new Date('2026-03-12T10:00:00.000Z').getTime(),
    method: 'GET',
    host: 'api.example.com',
    path: '/users',
    statusCode: 200,
    contentType: 'application/json',
    size: 1024,
  },
  {
    id: '2',
    timestamp: new Date('2026-03-12T10:00:01.000Z').getTime(),
    method: 'POST',
    host: 'api.example.com',
    path: '/users',
    statusCode: 404,
    contentType: 'application/json; charset=utf-8',
    size: 512,
  },
]

beforeEach(() => {
  useInterceptStore.setState({
    requests: [],
    selectedRequestId: null,
    searchQuery: '',
    searchMode: 'fuzzy',
    verbFilter: null,
    statusFilter: null,
  })
  vi.clearAllMocks()
})

describe('InterceptTable', () => {
  it('renders all column headers', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptTable />)
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Method')).toBeInTheDocument()
    expect(screen.getByText('Host + Path')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Size')).toBeInTheDocument()
  })

  it('renders request data when requests exist', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptTable />)
    // GET appears in both the filter dropdown option and the method badge
    expect(screen.getAllByText('GET').length).toBeGreaterThanOrEqual(1)
  })

  it('renders method badges with correct text', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptTable />)
    // Method badges appear inside spans; filter dropdown also has option elements
    const getSpans = screen.getAllByText('GET').filter((el) => el.tagName === 'SPAN')
    const postSpans = screen.getAllByText('POST').filter((el) => el.tagName === 'SPAN')
    expect(getSpans.length).toBeGreaterThan(0)
    expect(postSpans.length).toBeGreaterThan(0)
  })

  it('renders host + path for each row', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptTable />)
    expect(screen.getAllByText('api.example.com/users')).toHaveLength(2)
  })

  it('renders status codes', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptTable />)
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
  })
})

describe('Filter bar', () => {
  it('renders search input', () => {
    render(<InterceptTable />)
    expect(screen.getByRole('textbox', { name: /search requests/i })).toBeInTheDocument()
  })

  it('renders regex toggle button', () => {
    render(<InterceptTable />)
    expect(screen.getByRole('button', { name: /toggle regex mode/i })).toBeInTheDocument()
  })

  it('renders verb filter dropdown', () => {
    render(<InterceptTable />)
    expect(screen.getByRole('combobox', { name: /filter by method/i })).toBeInTheDocument()
  })

  it('renders status filter dropdown', () => {
    render(<InterceptTable />)
    expect(screen.getByRole('combobox', { name: /filter by status/i })).toBeInTheDocument()
  })

  it('fuzzy search filters rows by URL', () => {
    const mixedRequests: InterceptRequest[] = [
      { id: '1', timestamp: Date.now(), method: 'GET', host: 'alpha.com', path: '/foo', statusCode: 200 },
      { id: '2', timestamp: Date.now(), method: 'POST', host: 'beta.com', path: '/bar', statusCode: 200 },
    ]
    useInterceptStore.setState({ requests: mixedRequests, searchQuery: 'alpha' })
    render(<InterceptTable />)
    expect(screen.getByText('alpha.com/foo')).toBeInTheDocument()
    expect(screen.queryByText('beta.com/bar')).not.toBeInTheDocument()
  })

  it('regex search filters rows', () => {
    const mixedRequests: InterceptRequest[] = [
      { id: '1', timestamp: Date.now(), method: 'GET', host: 'alpha.com', path: '/foo', statusCode: 200 },
      { id: '2', timestamp: Date.now(), method: 'POST', host: 'beta.com', path: '/bar', statusCode: 200 },
    ]
    useInterceptStore.setState({ requests: mixedRequests, searchQuery: '^get', searchMode: 'regex' })
    render(<InterceptTable />)
    expect(screen.getByText('alpha.com/foo')).toBeInTheDocument()
    expect(screen.queryByText('beta.com/bar')).not.toBeInTheDocument()
  })

  it('verb filter shows only matching method rows', () => {
    useInterceptStore.setState({ requests: sampleRequests, verbFilter: 'GET' })
    render(<InterceptTable />)
    // GET span badge should be present in the row
    const getSpans = screen.getAllByText('GET').filter((el) => el.tagName === 'SPAN')
    expect(getSpans.length).toBeGreaterThan(0)
    // POST span badge should not appear (POST option still exists in dropdown)
    const postSpans = screen.queryAllByText('POST').filter((el) => el.tagName === 'SPAN')
    expect(postSpans.length).toBe(0)
  })

  it('status filter shows only matching status rows', () => {
    useInterceptStore.setState({ requests: sampleRequests, statusFilter: '4xx' })
    render(<InterceptTable />)
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.queryByText('200')).not.toBeInTheDocument()
  })

  it('shows "no match" empty state when requests exist but all filtered out', () => {
    useInterceptStore.setState({ requests: sampleRequests, verbFilter: 'DELETE' })
    render(<InterceptTable />)
    expect(screen.getByText('No requests match filters')).toBeInTheDocument()
  })

  it('does not show "no match" empty state when no requests at all', () => {
    render(<InterceptTable />)
    expect(screen.queryByText('No requests match filters')).not.toBeInTheDocument()
    expect(screen.getByText('No intercepted requests yet')).toBeInTheDocument()
  })
})

describe('Row selection', () => {
  it('clicking a row sets selectedRequestId', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptTable />)
    const rows = screen.getAllByText('api.example.com/users')
    fireEvent.click(rows[0])
    expect(useInterceptStore.getState().selectedRequestId).toBe('1')
  })

  it('selected row has highlight class', () => {
    useInterceptStore.setState({ requests: sampleRequests, selectedRequestId: '1' })
    render(<InterceptTable />)
    // The row with id '1' should have the selection highlight class
    const rows = screen.getAllByText('api.example.com/users')
    // The selected row's parent container has 'bg-blue-500/10'
    const firstRowParent = rows[0].closest('.absolute')
    expect(firstRowParent?.className).toContain('bg-blue-500/10')
  })

  it('unselected rows do not have highlight class', () => {
    useInterceptStore.setState({ requests: sampleRequests, selectedRequestId: '1' })
    render(<InterceptTable />)
    const rows = screen.getAllByText('api.example.com/users')
    const secondRowParent = rows[1].closest('.absolute')
    expect(secondRowParent?.className).not.toContain('bg-blue-500/10')
  })
})

describe('InterceptView', () => {
  it('shows empty state when no requests', () => {
    render(<InterceptView />)
    expect(screen.getByText('No intercepted requests yet')).toBeInTheDocument()
  })

  it('shows table when requests exist', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptView />)
    expect(screen.getByText('Time')).toBeInTheDocument()
    // GET appears in both the method badge and filter dropdown option
    expect(screen.getAllByText('GET').length).toBeGreaterThanOrEqual(1)
  })

  it('does not show table column headers in empty state', () => {
    render(<InterceptView />)
    expect(screen.queryByText('Time')).not.toBeInTheDocument()
  })

  it('shows split-pane bottom placeholder', () => {
    render(<InterceptView />)
    expect(screen.getByText('Select a request to view details')).toBeInTheDocument()
  })
})

describe('InterceptTable.utils', () => {
  describe('formatTimestamp', () => {
    it('formats a unix timestamp to HH:MM:SS.mmm', () => {
      const ts = new Date('2026-03-12T12:34:56.789Z').getTime()
      const result = formatTimestamp(ts)
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/)
    })
  })

  describe('formatHostPath', () => {
    it('concatenates host and path', () => {
      expect(formatHostPath('api.example.com', '/users')).toBe('api.example.com/users')
    })

    it('handles empty path', () => {
      expect(formatHostPath('api.example.com', '')).toBe('api.example.com')
    })
  })

  describe('formatContentType', () => {
    it('strips charset parameters', () => {
      expect(formatContentType('application/json; charset=utf-8')).toBe('application/json')
    })

    it('returns plain content type unchanged', () => {
      expect(formatContentType('text/html')).toBe('text/html')
    })

    it('returns dash for undefined', () => {
      expect(formatContentType(undefined)).toBe('—')
    })
  })

  describe('formatSize', () => {
    it('formats bytes under 1 KB', () => {
      expect(formatSize(512)).toBe('512 B')
    })

    it('formats KB', () => {
      expect(formatSize(1024)).toBe('1.0 KB')
    })

    it('formats MB', () => {
      expect(formatSize(1024 * 1024)).toBe('1.0 MB')
    })

    it('returns dash for undefined', () => {
      expect(formatSize(undefined)).toBe('—')
    })
  })

  describe('filterRequests', () => {
    const reqs: InterceptRequest[] = [
      { id: '1', timestamp: 0, method: 'GET', host: 'alpha.com', path: '/users', statusCode: 200 },
      { id: '2', timestamp: 0, method: 'POST', host: 'beta.com', path: '/items', statusCode: 404 },
      { id: '3', timestamp: 0, method: 'DELETE', host: 'gamma.com', path: '/data', statusCode: 500 },
    ]

    it('returns all requests with no filters', () => {
      expect(filterRequests(reqs, { searchQuery: '', searchMode: 'fuzzy', verbFilter: null, statusFilter: null })).toHaveLength(3)
    })

    it('filters by verb', () => {
      const result = filterRequests(reqs, { searchQuery: '', searchMode: 'fuzzy', verbFilter: 'GET', statusFilter: null })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('filters by 2xx status', () => {
      const result = filterRequests(reqs, { searchQuery: '', searchMode: 'fuzzy', verbFilter: null, statusFilter: '2xx' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('filters by 4xx status', () => {
      const result = filterRequests(reqs, { searchQuery: '', searchMode: 'fuzzy', verbFilter: null, statusFilter: '4xx' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })

    it('filters by 5xx status', () => {
      const result = filterRequests(reqs, { searchQuery: '', searchMode: 'fuzzy', verbFilter: null, statusFilter: '5xx' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('3')
    })

    it('fuzzy search filters by host', () => {
      const result = filterRequests(reqs, { searchQuery: 'alpha', searchMode: 'fuzzy', verbFilter: null, statusFilter: null })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('fuzzy search is case-insensitive', () => {
      const result = filterRequests(reqs, { searchQuery: 'ALPHA', searchMode: 'fuzzy', verbFilter: null, statusFilter: null })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('regex search filters by pattern', () => {
      const result = filterRequests(reqs, { searchQuery: '^get', searchMode: 'regex', verbFilter: null, statusFilter: null })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('invalid regex returns empty array', () => {
      const result = filterRequests(reqs, { searchQuery: '[invalid', searchMode: 'regex', verbFilter: null, statusFilter: null })
      expect(result).toHaveLength(0)
    })

    it('combined verb and status filters', () => {
      const result = filterRequests(reqs, { searchQuery: '', searchMode: 'fuzzy', verbFilter: 'GET', statusFilter: '2xx' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('combined verb and status that match nothing returns empty', () => {
      const result = filterRequests(reqs, { searchQuery: '', searchMode: 'fuzzy', verbFilter: 'GET', statusFilter: '5xx' })
      expect(result).toHaveLength(0)
    })

    it('pending requests pass through status filters', () => {
      const withPending: InterceptRequest[] = [
        { id: '1', timestamp: 0, method: 'GET', host: 'alpha.com', path: '/users', statusCode: 200 },
        { id: '2', timestamp: 0, method: 'POST', host: 'beta.com', path: '/items', isPending: true },
      ]
      const result = filterRequests(withPending, { searchQuery: '', searchMode: 'fuzzy', verbFilter: null, statusFilter: '2xx' })
      expect(result).toHaveLength(2) // both the 200 and the pending request
    })

    it('pending requests are filterable by verb', () => {
      const withPending: InterceptRequest[] = [
        { id: '1', timestamp: 0, method: 'GET', host: 'alpha.com', path: '/users', isPending: true },
        { id: '2', timestamp: 0, method: 'POST', host: 'beta.com', path: '/items', isPending: true },
      ]
      const result = filterRequests(withPending, { searchQuery: '', searchMode: 'fuzzy', verbFilter: 'GET', statusFilter: null })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })
  })
})

describe('Split event store actions', () => {
  it('addPendingRequest creates a pending entry', () => {
    useInterceptStore.getState().addPendingRequest({
      id: 'split-1',
      timestamp: Date.now(),
      method: 'GET',
      host: 'example.com',
      path: '/api',
      requestHeaders: { 'accept': 'application/json' },
    })
    const requests = useInterceptStore.getState().requests
    expect(requests).toHaveLength(1)
    expect(requests[0].isPending).toBe(true)
    expect(requests[0].method).toBe('GET')
    expect(requests[0].statusCode).toBeUndefined()
  })

  it('addPendingRequest skips if ID already exists', () => {
    useInterceptStore.setState({
      requests: [{ id: 'dup-1', timestamp: 0, method: 'GET', host: 'x.com', path: '/' }],
    })
    useInterceptStore.getState().addPendingRequest({
      id: 'dup-1',
      timestamp: Date.now(),
      method: 'POST',
      host: 'y.com',
      path: '/other',
      requestHeaders: {},
    })
    const requests = useInterceptStore.getState().requests
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('GET') // unchanged
  })

  it('updateWithResponse merges response data and clears isPending', () => {
    useInterceptStore.setState({
      requests: [{ id: 'resp-1', timestamp: 0, method: 'GET', host: 'x.com', path: '/', isPending: true }],
    })
    useInterceptStore.getState().updateWithResponse({
      id: 'resp-1',
      statusCode: 200,
      statusText: 'OK',
      responseHeaders: { 'content-type': 'application/json' },
      responseBody: '{"ok":true}',
      contentType: 'application/json',
      size: 11,
      responseTimeMs: 42,
    })
    const req = useInterceptStore.getState().requests[0]
    expect(req.isPending).toBe(false)
    expect(req.statusCode).toBe(200)
    expect(req.responseBody).toBe('{"ok":true}')
    expect(req.contentType).toBe('application/json')
    expect(req.size).toBe(11)
  })

  it('updateWithResponse is a no-op if ID not found', () => {
    useInterceptStore.setState({ requests: [] })
    useInterceptStore.getState().updateWithResponse({
      id: 'missing',
      statusCode: 200,
      statusText: 'OK',
      responseHeaders: {},
      size: 0,
      responseTimeMs: 0,
    })
    expect(useInterceptStore.getState().requests).toHaveLength(0)
  })

  it('addRequest merges into existing pending entry and clears isPending', () => {
    useInterceptStore.setState({
      requests: [{ id: 'merge-1', timestamp: 0, method: 'GET', host: 'x.com', path: '/', isPending: true }],
    })
    useInterceptStore.getState().addRequest({
      id: 'merge-1',
      timestamp: 0,
      method: 'GET',
      host: 'x.com',
      path: '/',
      statusCode: 200,
      responseBody: 'data',
    })
    const req = useInterceptStore.getState().requests[0]
    expect(req.isPending).toBe(false)
    expect(req.statusCode).toBe(200)
  })
})

describe('Pending row rendering', () => {
  it('renders Pending badge for pending requests', () => {
    useInterceptStore.setState({
      requests: [{ id: 'p1', timestamp: Date.now(), method: 'GET', host: 'example.com', path: '/api', isPending: true }],
    })
    render(<InterceptTable />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('renders status code after response arrives (not Pending)', () => {
    useInterceptStore.setState({
      requests: [{ id: 'p2', timestamp: Date.now(), method: 'GET', host: 'example.com', path: '/api', statusCode: 200, isPending: false }],
    })
    render(<InterceptTable />)
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })
})

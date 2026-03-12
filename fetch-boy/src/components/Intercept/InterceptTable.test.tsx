import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InterceptTable } from './InterceptTable'
import { InterceptView } from './InterceptView'
import { useInterceptStore } from '@/stores/interceptStore'
import type { InterceptRequest } from '@/stores/interceptStore'
import {
  formatTimestamp,
  formatHostPath,
  formatContentType,
  formatSize,
} from './InterceptTable.utils'

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
  useInterceptStore.setState({ requests: [] })
})

describe('InterceptTable', () => {
  it('renders all 6 column headers', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptTable />)
    expect(screen.getByText('Timestamp')).toBeInTheDocument()
    expect(screen.getByText('Method')).toBeInTheDocument()
    expect(screen.getByText('Host + Path')).toBeInTheDocument()
    expect(screen.getByText('Status Code')).toBeInTheDocument()
    expect(screen.getByText('Content-Type')).toBeInTheDocument()
    expect(screen.getByText('Size')).toBeInTheDocument()
  })

  it('renders a row for each request', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptTable />)
    const rows = screen.getAllByRole('row')
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3)
  })

  it('renders method badges with correct text', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptTable />)
    expect(screen.getByText('GET')).toBeInTheDocument()
    expect(screen.getByText('POST')).toBeInTheDocument()
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

describe('InterceptView', () => {
  it('shows empty state when no requests', () => {
    render(<InterceptView />)
    expect(screen.getByText('Traffic Intercept')).toBeInTheDocument()
    expect(screen.getByText('Start the proxy to see requests here.')).toBeInTheDocument()
  })

  it('shows table when requests exist', () => {
    useInterceptStore.setState({ requests: sampleRequests })
    render(<InterceptView />)
    expect(screen.getByText('Timestamp')).toBeInTheDocument()
    expect(screen.getByText('GET')).toBeInTheDocument()
  })

  it('does not show table column headers in empty state', () => {
    render(<InterceptView />)
    expect(screen.queryByText('Timestamp')).not.toBeInTheDocument()
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
})

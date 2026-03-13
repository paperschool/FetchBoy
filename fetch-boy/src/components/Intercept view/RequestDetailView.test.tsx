import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RequestDetailView } from './RequestDetailView'
import type { InterceptRequest } from '@/stores/interceptStore'

const mockRequest: InterceptRequest = {
  id: 'req-123',
  timestamp: new Date('2026-03-13T12:34:56.000Z').getTime(),
  method: 'GET',
  host: 'api.example.com',
  path: '/users/1',
  statusCode: 200,
  contentType: 'application/json',
  size: 1234,
  responseBody: '{"id": 1, "name": "John"}',
  requestHeaders: { Authorization: 'Bearer token', Accept: 'application/json' },
  responseHeaders: { 'Content-Type': 'application/json' },
}

beforeEach(() => {
  // reset clipboard mock if needed
})

describe('RequestDetailView', () => {
  it('renders empty state when no request selected', () => {
    render(<RequestDetailView selectedRequest={null} />)
    expect(screen.getByText('Select a request to view details')).toBeInTheDocument()
  })

  it('does not render metadata when no request selected', () => {
    render(<RequestDetailView selectedRequest={null} />)
    expect(screen.queryByText('Body')).not.toBeInTheDocument()
    expect(screen.queryByText('Headers')).not.toBeInTheDocument()
  })

  it('renders host+path URL when request selected', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    expect(screen.getByText('api.example.com/users/1')).toBeInTheDocument()
  })

  it('renders HTTP method badge', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    const badge = screen.getAllByText('GET').find((el) => el.tagName === 'SPAN')
    expect(badge).toBeInTheDocument()
  })

  it('renders status code badge', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    const badge = screen.getAllByText('200').find((el) => el.tagName === 'SPAN')
    expect(badge).toBeInTheDocument()
  })

  it('renders size', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    expect(screen.getByText('1.2 KB')).toBeInTheDocument()
  })

  it('renders Body and Headers tab buttons', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('Headers')).toBeInTheDocument()
  })

  it('Body tab is active by default and shows parsed JSON', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    const pre = screen.getByText(/"name": "John"/, { selector: 'pre' })
    expect(pre).toBeInTheDocument()
  })

  it('clicking Headers tab shows request and response header sections', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    fireEvent.click(screen.getByText('Headers'))
    expect(screen.getByText('Request Headers')).toBeInTheDocument()
    expect(screen.getByText('Response Headers')).toBeInTheDocument()
  })

  it('Headers tab shows request header keys', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    fireEvent.click(screen.getByText('Headers'))
    expect(screen.getByText('Authorization:')).toBeInTheDocument()
    expect(screen.getByText('Bearer token')).toBeInTheDocument()
  })

  it('Headers tab shows response header keys', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    fireEvent.click(screen.getByText('Headers'))
    expect(screen.getByText('Content-Type:')).toBeInTheDocument()
  })

  it('clicking Body tab switches back to body content', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    fireEvent.click(screen.getByText('Headers'))
    fireEvent.click(screen.getByText('Body'))
    const pre = screen.getByText(/"name": "John"/, { selector: 'pre' })
    expect(pre).toBeInTheDocument()
  })

  it('shows "No response body" when responseBody is absent', () => {
    const req: InterceptRequest = { ...mockRequest, responseBody: undefined }
    render(<RequestDetailView selectedRequest={req} />)
    expect(screen.getByText('No response body')).toBeInTheDocument()
  })

  it('shows "No headers" when requestHeaders is empty', () => {
    const req: InterceptRequest = { ...mockRequest, requestHeaders: {}, responseHeaders: {} }
    render(<RequestDetailView selectedRequest={req} />)
    fireEvent.click(screen.getByText('Headers'))
    const noHeaders = screen.getAllByText('No headers')
    expect(noHeaders.length).toBe(2)
  })

  it('renders plain text body when content type is not JSON', () => {
    const req: InterceptRequest = {
      ...mockRequest,
      contentType: 'text/plain',
      responseBody: 'hello world',
    }
    render(<RequestDetailView selectedRequest={req} />)
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('does not show status badge when statusCode is undefined', () => {
    const req: InterceptRequest = { ...mockRequest, statusCode: undefined }
    render(<RequestDetailView selectedRequest={req} />)
    // No status code span (200 etc.) should appear
    expect(screen.queryByText('200')).not.toBeInTheDocument()
  })
})

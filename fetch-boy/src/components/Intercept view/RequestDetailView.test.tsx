import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { RequestDetailView } from './RequestDetailView'
import type { InterceptRequest } from '@/stores/interceptStore'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, options, language, path }: { value?: string; options?: { readOnly?: boolean }; language?: string; path?: string }) => (
    <div
      data-testid="monaco-editor"
      data-readonly={options?.readOnly ? 'true' : 'false'}
      data-language={language ?? ''}
      data-path={path ?? ''}
    >
      {value}
    </div>
  ),
}))

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

describe('RequestDetailView', () => {
  it('renders empty state when no request selected', () => {
    render(<RequestDetailView selectedRequest={null} />)
    expect(screen.getByText('Select a request to view details')).toBeInTheDocument()
  })

  it('does not render subtabs when no request selected', () => {
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

  it('Body tab is active by default and renders Monaco editor', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    const editor = screen.getByTestId('intercept-response-body-editor')
    expect(within(editor).getByTestId('monaco-editor')).toBeInTheDocument()
  })

  it('Monaco editor is read-only', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    const editor = screen.getByTestId('intercept-response-body-editor')
    expect(within(editor).getByTestId('monaco-editor')).toHaveAttribute('data-readonly', 'true')
  })

  it('Monaco editor shows pretty-printed JSON body', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    const monaco = within(screen.getByTestId('intercept-response-body-editor')).getByTestId('monaco-editor')
    expect(monaco.textContent).toContain('"name": "John"')
  })

  it('renders language selector with JSON selected for JSON content', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    const select = screen.getByRole('combobox', { name: /body language/i })
    expect(select).toBeInTheDocument()
  })

  it('clicking Headers tab shows request and response header sections', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    fireEvent.click(screen.getByText('Headers'))
    expect(screen.getByText('Request Headers')).toBeInTheDocument()
    expect(screen.getByText('Response Headers')).toBeInTheDocument()
  })

  it('Headers tab shows request header rows', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    fireEvent.click(screen.getByText('Headers'))
    expect(screen.getByText('Authorization')).toBeInTheDocument()
    expect(screen.getByText('Bearer token')).toBeInTheDocument()
  })

  it('Headers tab shows response header rows', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    fireEvent.click(screen.getByText('Headers'))
    expect(screen.getByText('Content-Type')).toBeInTheDocument()
    // application/json appears in both Accept (request) and Content-Type (response)
    expect(screen.getAllByText('application/json').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking Body tab switches back from headers', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    fireEvent.click(screen.getByText('Headers'))
    fireEvent.click(screen.getByText('Body'))
    expect(screen.getByTestId('intercept-response-body-editor')).toBeInTheDocument()
  })

  it('shows empty string in Monaco when responseBody is absent', () => {
    const req: InterceptRequest = { ...mockRequest, responseBody: undefined }
    render(<RequestDetailView selectedRequest={req} />)
    const monaco = within(screen.getByTestId('intercept-response-body-editor')).getByTestId('monaco-editor')
    expect(monaco.textContent).toBe('')
  })

  it('shows "No request headers" when requestHeaders is empty', () => {
    const req: InterceptRequest = { ...mockRequest, requestHeaders: {}, responseHeaders: {} }
    render(<RequestDetailView selectedRequest={req} />)
    fireEvent.click(screen.getByText('Headers'))
    expect(screen.getAllByText('No request headers')).toHaveLength(1)
    expect(screen.getAllByText('No response headers')).toHaveLength(1)
  })

  it('does not show status badge when statusCode is undefined', () => {
    const req: InterceptRequest = { ...mockRequest, statusCode: undefined }
    render(<RequestDetailView selectedRequest={req} />)
    expect(screen.queryByText('200')).not.toBeInTheDocument()
  })
})

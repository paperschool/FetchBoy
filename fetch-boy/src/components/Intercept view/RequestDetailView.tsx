import { useState } from 'react'
import type { InterceptRequest } from '@/stores/interceptStore'
import {
  formatTimestamp,
  formatSize,
  formatHostPath,
  CopyButton,
} from './InterceptTable.utils'

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400',
  POST: 'bg-blue-500/20 text-blue-400',
  PUT: 'bg-orange-500/20 text-orange-400',
  PATCH: 'bg-yellow-500/20 text-yellow-400',
  DELETE: 'bg-red-500/20 text-red-400',
  HEAD: 'bg-gray-500/20 text-gray-400',
  OPTIONS: 'bg-purple-500/20 text-purple-400',
}

function getStatusBadgeClass(code: number): string {
  if (code >= 200 && code < 300) return 'bg-green-500/20 text-green-400'
  if (code >= 300 && code < 400) return 'bg-blue-500/20 text-blue-400'
  if (code >= 400 && code < 500) return 'bg-yellow-500/20 text-yellow-400'
  if (code >= 500) return 'bg-red-500/20 text-red-400'
  return 'bg-gray-500/20 text-gray-400'
}

function BodyContent({ body, contentType }: { body?: string; contentType?: string }) {
  if (!body) {
    return <div className="text-app-muted text-sm">No response body</div>
  }

  const looksLikeJson =
    contentType?.includes('json') ||
    body.trim().startsWith('{') ||
    body.trim().startsWith('[')

  if (looksLikeJson) {
    try {
      const parsed: unknown = JSON.parse(body)
      return (
        <pre className="text-xs font-mono text-app-primary whitespace-pre-wrap">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )
    } catch {
      // fall through to plain text
    }
  }

  return (
    <pre className="text-xs font-mono text-app-primary whitespace-pre-wrap">{body}</pre>
  )
}

function HeadersContent({
  requestHeaders,
  responseHeaders,
}: {
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
}) {
  function renderKeyValue(headers: Record<string, string> | undefined, title: string) {
    return (
      <div className="mb-4">
        <div className="text-xs font-medium text-app-secondary mb-2">{title}</div>
        {!headers || Object.keys(headers).length === 0 ? (
          <div className="text-app-muted text-sm italic">No headers</div>
        ) : (
          <div className="space-y-1">
            {Object.entries(headers).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs">
                <span className="text-blue-400 font-mono shrink-0">{key}:</span>
                <span className="text-app-primary font-mono break-all">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {renderKeyValue(requestHeaders, 'Request Headers')}
      {renderKeyValue(responseHeaders, 'Response Headers')}
    </div>
  )
}

interface RequestDetailViewProps {
  selectedRequest: InterceptRequest | null
}

export function RequestDetailView({ selectedRequest }: RequestDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body')

  if (!selectedRequest) {
    return (
      <div className="flex-1 flex items-center justify-center text-app-muted text-sm">
        Select a request to view details
      </div>
    )
  }

  const fullUrl = formatHostPath(selectedRequest.host, selectedRequest.path)
  const methodColor =
    METHOD_COLORS[selectedRequest.method.toUpperCase()] ?? 'bg-gray-500/20 text-gray-400'

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Metadata header */}
      <div className="flex-shrink-0 p-3 border-b border-app-subtle space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-app-muted font-mono truncate flex-1" title={fullUrl}>
            {fullUrl}
          </span>
          <CopyButton text={fullUrl} />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${methodColor}`}>
            {selectedRequest.method}
          </span>
          {selectedRequest.statusCode !== undefined && (
            <span className={`px-2 py-0.5 rounded ${getStatusBadgeClass(selectedRequest.statusCode)}`}>
              {selectedRequest.statusCode}
            </span>
          )}
          <span className="text-app-muted">{formatSize(selectedRequest.size)}</span>
          <span className="text-app-muted">{formatTimestamp(selectedRequest.timestamp)}</span>
        </div>
      </div>

      {/* Subtabs */}
      <div className="flex-shrink-0 flex border-b border-app-subtle">
        <button
          onClick={() => setActiveTab('body')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'body'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-app-muted hover:text-app-primary'
          }`}
        >
          Body
        </button>
        <button
          onClick={() => setActiveTab('headers')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'headers'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-app-muted hover:text-app-primary'
          }`}
        >
          Headers
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        {activeTab === 'body' ? (
          <BodyContent
            body={selectedRequest.responseBody}
            contentType={selectedRequest.contentType}
          />
        ) : (
          <HeadersContent
            requestHeaders={selectedRequest.requestHeaders}
            responseHeaders={selectedRequest.responseHeaders}
          />
        )}
      </div>
    </div>
  )
}

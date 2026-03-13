import { useState, useMemo, useEffect } from 'react'
import type { InterceptRequest } from '@/stores/interceptStore'
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField'
import { useUiSettingsStore } from '@/stores/uiSettingsStore'
import { HeadersTable } from '@/components/ui/HeadersTable'
import {
  formatTimestamp,
  formatSize,
  formatHostPath,
  CopyButton,
} from './InterceptTable.utils'

type BodyLanguage = 'json' | 'html' | 'xml' | 'plaintext'

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

interface RequestDetailViewProps {
  selectedRequest: InterceptRequest | null
}

export function RequestDetailView({ selectedRequest }: RequestDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body')
  const [bodyLanguage, setBodyLanguage] = useState<BodyLanguage>('plaintext')
  const editorFontSize = useUiSettingsStore((s) => s.editorFontSize)

  const formattedBody = useMemo(() => {
    if (!selectedRequest?.responseBody) return null
    try {
      return JSON.stringify(JSON.parse(selectedRequest.responseBody), null, 2)
    } catch {
      return null
    }
  }, [selectedRequest?.responseBody])

  useEffect(() => {
    if (!selectedRequest) return
    const ct = selectedRequest.contentType?.toLowerCase() ?? ''
    if (formattedBody || ct.includes('json')) setBodyLanguage('json')
    else if (ct.includes('html')) setBodyLanguage('html')
    else if (ct.includes('xml')) setBodyLanguage('xml')
    else setBodyLanguage('plaintext')
  }, [selectedRequest?.id, formattedBody])

  if (!selectedRequest) {
    return (
      <div className="flex-1 flex items-center justify-center text-app-muted text-sm">
        Select a request to view details
      </div>
    )
  }

  const fullUrl = formatHostPath(selectedRequest.host, selectedRequest.path)
  const methodColor = METHOD_COLORS[selectedRequest.method.toUpperCase()] ?? 'bg-gray-500/20 text-gray-400'
  const requestHeaderEntries = Object.entries(selectedRequest.requestHeaders ?? {}).map(([key, value]) => ({ key, value }))
  const responseHeaderEntries = Object.entries(selectedRequest.responseHeaders ?? {}).map(([key, value]) => ({ key, value }))

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

      {/* Body tab */}
      {activeTab === 'body' && (
        <div className="flex-1 min-h-0 relative">
          <div className="absolute top-2 right-2 z-10">
            <select
              value={bodyLanguage}
              onChange={(e) => setBodyLanguage(e.target.value as BodyLanguage)}
              className="select-flat border-app-subtle bg-app-main text-app-primary h-8 rounded-md border pl-2 pr-7 text-xs"
              aria-label="Body language"
            >
              <option value="json">JSON</option>
              <option value="html">HTML</option>
              <option value="xml">XML</option>
              <option value="plaintext">Raw</option>
            </select>
          </div>
          <MonacoEditorField
            testId="intercept-response-body-editor"
            path="intercept-response-body"
            language={bodyLanguage}
            value={formattedBody ?? selectedRequest.responseBody ?? ''}
            fontSize={editorFontSize}
            height="100%"
            readOnly
          />
        </div>
      )}

      {/* Headers tab */}
      {activeTab === 'headers' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-xs font-medium text-app-secondary mb-2">Request Headers</p>
            <HeadersTable headers={requestHeaderEntries} emptyMessage="No request headers" />
          </div>
          <div>
            <p className="text-xs font-medium text-app-secondary mb-2">Response Headers</p>
            <HeadersTable headers={responseHeaderEntries} emptyMessage="No response headers" />
          </div>
        </div>
      )}
    </div>
  )
}

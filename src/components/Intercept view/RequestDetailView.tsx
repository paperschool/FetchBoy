import { useState, useMemo, useEffect, useCallback } from 'react'
import type { InterceptRequest, BreakpointModifications } from '@/stores/interceptStore'
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField'
import { useUiSettingsStore } from '@/stores/uiSettingsStore'
import { useBreakpointsStore } from '@/stores/breakpointsStore'
import { createBreakpoint } from '@/lib/breakpoints'
import { SaveBreakpointDialog } from '@/components/SaveBreakpointDialog/SaveBreakpointDialog'
import { HeadersTable } from '@/components/ui/HeadersTable'
import { ViewerShell } from '@/components/ui/ViewerShell'
import { isImageContentType, ImageViewer } from '@/components/ResponseViewer/ResponseViewer'
import {
  formatTimestamp,
  formatSize,
  formatHostPath,
  CopyButton,
} from './InterceptTable.utils'
import { openInFetch } from './openInFetch'

type BodyLanguage = 'json' | 'html' | 'xml' | 'plaintext'
type DetailTab = 'body' | 'headers' | 'params' | 'options'

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

const TABS = [
  { id: 'body', label: 'Body' },
  { id: 'headers', label: 'Headers' },
  { id: 'params', label: 'Params' },
  { id: 'options', label: 'Options' },
]

interface RequestDetailViewProps {
  selectedRequest: InterceptRequest | null
  editMode?: boolean
  pendingMods?: BreakpointModifications
  onModsChange?: (mods: Partial<BreakpointModifications>) => void
}

export function RequestDetailView({ selectedRequest, editMode = false, pendingMods = {}, onModsChange }: RequestDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('body')
  const [bodyLanguage, setBodyLanguage] = useState<BodyLanguage>('plaintext')
  const editorFontSize = useUiSettingsStore((s) => s.editorFontSize)
  const [newHeaderKey, setNewHeaderKey] = useState('')
  const [newHeaderValue, setNewHeaderValue] = useState('')
  const [breakDialogOpen, setBreakDialogOpen] = useState(false)
  const { addBreakpoint, startEditing } = useBreakpointsStore()

  const handleBreakSave = useCallback(async (name: string, urlPattern: string, folderId: string | null) => {
    const bp = await createBreakpoint(folderId, name, urlPattern, 'partial')
    addBreakpoint(bp)
    startEditing(bp, folderId)
    setBreakDialogOpen(false)
  }, [addBreakpoint, startEditing])

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

  const queryParams = useMemo(() => {
    if (!selectedRequest?.path) return []
    try {
      const search = selectedRequest.path.includes('?')
        ? selectedRequest.path.slice(selectedRequest.path.indexOf('?'))
        : ''
      return Array.from(new URLSearchParams(search).entries()).map(([key, value]) => ({ key, value }))
    } catch {
      return []
    }
  }, [selectedRequest?.path])

  if (!selectedRequest) {
    return (
      <ViewerShell testId="intercept-detail-viewer">
        <div className="flex-1 flex items-center justify-center text-app-muted text-sm">
          Select a request to view details
        </div>
      </ViewerShell>
    )
  }

  const fullUrl = formatHostPath(selectedRequest.host, selectedRequest.path)
  const methodColor = METHOD_COLORS[selectedRequest.method.toUpperCase()] ?? 'bg-gray-500/20 text-gray-400'
  const requestHeaderEntries = Object.entries(selectedRequest.requestHeaders ?? {}).map(([key, value]) => ({ key, value }))
  const responseHeaderEntries = Object.entries(selectedRequest.responseHeaders ?? {}).map(([key, value]) => ({ key, value }))

  const header = (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-app-muted font-mono truncate flex-1" title={fullUrl}>
          {fullUrl}
        </span>
        <CopyButton text={fullUrl} />
        <button
          type="button"
          onClick={() => openInFetch(selectedRequest)}
          className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
          title="Open in Fetch tab"
        >
          Open in Fetch
        </button>
        <button
          type="button"
          onClick={() => setBreakDialogOpen(true)}
          className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          title="Add breakpoint for this URL"
        >
          Add Breakpoint
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className={`px-2 py-0.5 rounded font-medium ${methodColor}`}>
          {selectedRequest.method}
        </span>
        {editMode ? (
          <input
            type="number"
            value={pendingMods.statusCode ?? selectedRequest.statusCode ?? ''}
            onChange={(e) => onModsChange?.({ statusCode: e.target.value ? Number(e.target.value) : undefined })}
            className="w-20 px-2 py-0.5 rounded border border-amber-500/50 bg-amber-900/20 text-amber-200 text-xs font-mono focus:outline-none focus:border-amber-400"
            placeholder="Status"
            min={100}
            max={599}
            aria-label="Status code"
          />
        ) : (
          selectedRequest.statusCode !== undefined && (
            <span className={`px-2 py-0.5 rounded ${getStatusBadgeClass(selectedRequest.statusCode)}`}>
              {selectedRequest.statusCode}
            </span>
          )
        )}
        {editMode ? (
          <input
            type="text"
            value={pendingMods.contentType ?? selectedRequest.contentType ?? ''}
            onChange={(e) => onModsChange?.({ contentType: e.target.value })}
            className="flex-1 min-w-0 px-2 py-0.5 rounded border border-amber-500/50 bg-amber-900/20 text-amber-200 text-xs font-mono focus:outline-none focus:border-amber-400"
            placeholder="Content-Type"
            aria-label="Content type"
          />
        ) : (
          <>
            <span className="text-app-secondary">{formatSize(selectedRequest.size)}</span>
            <span className="text-app-secondary">{formatTimestamp(selectedRequest.timestamp)}</span>
          </>
        )}
      </div>
    </div>
  )

  return (
    <>
    <ViewerShell
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as DetailTab)}
      header={header}
      testId="intercept-detail-viewer"
    >
      {activeTab === 'body' && (
        isImageContentType(selectedRequest.contentType) && !editMode ? (
          <div className="flex-1 min-h-0 p-2">
            <ImageViewer contentType={selectedRequest.contentType} body={selectedRequest.responseBody ?? ''} />
          </div>
        ) : (
          <div className="relative min-h-[220px] flex-1">
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
              value={editMode ? (pendingMods.responseBody ?? selectedRequest.responseBody ?? '') : (formattedBody ?? selectedRequest.responseBody ?? '')}
              fontSize={editorFontSize}
              height="100%"
              readOnly={!editMode}
              onChange={editMode ? (val) => onModsChange?.({ responseBody: val }) : undefined}
            />
          </div>
        )
      )}

      {activeTab === 'headers' && (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {editMode ? (
            <div>
              <p className="text-xs font-medium text-amber-400 mb-2">Response Headers</p>
              {(pendingMods.extraHeaders ?? []).map(([k, v], i) => (
                <div key={i} className="flex gap-1 mb-1">
                  <input
                    type="text"
                    value={k}
                    onChange={(e) => {
                      const updated = (pendingMods.extraHeaders ?? []).map((pair, idx) =>
                        idx === i ? [e.target.value, pair[1]] as [string, string] : pair
                      )
                      onModsChange?.({ extraHeaders: updated })
                    }}
                    className="w-2/5 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs font-mono text-app-primary focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={v}
                    onChange={(e) => {
                      const updated = (pendingMods.extraHeaders ?? []).map((pair, idx) =>
                        idx === i ? [pair[0], e.target.value] as [string, string] : pair
                      )
                      onModsChange?.({ extraHeaders: updated })
                    }}
                    className="flex-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs text-app-primary focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (pendingMods.extraHeaders ?? []).filter((_, idx) => idx !== i)
                      onModsChange?.({ extraHeaders: updated })
                    }}
                    className="shrink-0 text-red-400 hover:text-red-300 text-sm px-1.5"
                    aria-label="Remove header"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex gap-1 mt-2">
                <input
                  type="text"
                  value={newHeaderKey}
                  onChange={(e) => setNewHeaderKey(e.target.value)}
                  placeholder="Header name"
                  className="w-2/5 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs font-mono text-app-primary focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  value={newHeaderValue}
                  onChange={(e) => setNewHeaderValue(e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs text-app-primary focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newHeaderKey.trim()) return
                    const updated: [string, string][] = [...(pendingMods.extraHeaders ?? []), [newHeaderKey.trim(), newHeaderValue]]
                    onModsChange?.({ extraHeaders: updated })
                    setNewHeaderKey('')
                    setNewHeaderValue('')
                  }}
                  className="shrink-0 px-2 py-0.5 bg-amber-700/60 hover:bg-amber-600/70 rounded text-xs text-white transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-app-secondary mb-2">Request Headers (read-only)</p>
                <HeadersTable headers={requestHeaderEntries} emptyMessage="No request headers" />
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-app-secondary mb-2">Request Headers</p>
                <HeadersTable headers={requestHeaderEntries} emptyMessage="No request headers" />
              </div>
              <div>
                <p className="text-xs font-medium text-app-secondary mb-2">Response Headers</p>
                <HeadersTable headers={responseHeaderEntries} emptyMessage="No response headers" />
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'params' && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {editMode ? (
            <div>
              {(pendingMods.queryParams ?? []).map(([k, v], i) => (
                <div key={i} className="flex gap-1 mb-1">
                  <input
                    type="text"
                    value={k}
                    onChange={(e) => {
                      const updated = (pendingMods.queryParams ?? []).map((pair, idx) =>
                        idx === i ? [e.target.value, pair[1]] as [string, string] : pair
                      )
                      onModsChange?.({ queryParams: updated })
                    }}
                    className="w-2/5 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs font-mono text-app-primary focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={v}
                    onChange={(e) => {
                      const updated = (pendingMods.queryParams ?? []).map((pair, idx) =>
                        idx === i ? [pair[0], e.target.value] as [string, string] : pair
                      )
                      onModsChange?.({ queryParams: updated })
                    }}
                    className="flex-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs text-app-primary focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (pendingMods.queryParams ?? []).filter((_, idx) => idx !== i)
                      onModsChange?.({ queryParams: updated })
                    }}
                    className="shrink-0 text-red-400 hover:text-red-300 text-sm px-1.5"
                    aria-label="Remove param"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex gap-1 mt-2">
                <input
                  type="text"
                  value={newHeaderKey}
                  onChange={(e) => setNewHeaderKey(e.target.value)}
                  placeholder="Param name"
                  className="w-2/5 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs font-mono text-app-primary focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  value={newHeaderValue}
                  onChange={(e) => setNewHeaderValue(e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs text-app-primary focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newHeaderKey.trim()) return
                    const updated: [string, string][] = [...(pendingMods.queryParams ?? []), [newHeaderKey.trim(), newHeaderValue]]
                    onModsChange?.({ queryParams: updated })
                    setNewHeaderKey('')
                    setNewHeaderValue('')
                  }}
                  className="shrink-0 px-2 py-0.5 bg-amber-700/60 hover:bg-amber-600/70 rounded text-xs text-white transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <HeadersTable headers={queryParams} emptyMessage="No query parameters" />
          )}
        </div>
      )}

      {activeTab === 'options' && (
        <p className="text-app-muted text-sm">No options available yet.</p>
      )}
    </ViewerShell>
    <SaveBreakpointDialog
      open={breakDialogOpen}
      onClose={() => setBreakDialogOpen(false)}
      onSave={handleBreakSave}
      defaultName={(() => { const s = selectedRequest.path.split('/').filter(Boolean); return s[s.length - 1] ?? selectedRequest.host; })()}
      defaultUrlPattern={formatHostPath(selectedRequest.host, selectedRequest.path)}
    />
    </>
  )
}

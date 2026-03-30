import { useState, useMemo, useCallback } from 'react'
import type { InterceptRequest, BreakpointModifications } from '@/stores/interceptStore'
import { useInterceptStore } from '@/stores/interceptStore'
import { useUiSettingsStore } from '@/stores/uiSettingsStore'
import { useBreakpointsStore } from '@/stores/breakpointsStore'
import { useMappingsStore } from '@/stores/mappingsStore'
import { createBreakpoint } from '@/lib/breakpoints'
import { createMapping } from '@/lib/mappings'
import { SaveBreakpointDialog } from '@/components/SaveBreakpointDialog/SaveBreakpointDialog'
import { SaveMappingDialog } from '@/components/SaveMappingDialog/SaveMappingDialog'
import { HeadersTable } from '@/components/ui/HeadersTable'
import { ViewerShell } from '@/components/ui/ViewerShell'
import { METHOD_COLORS, getStatusBadgeClass } from '@/lib/statusColors'
import { formatTimestamp, formatSize, formatHostPath, CopyButton } from './InterceptTable.utils'
import { openInFetch } from './openInFetch'
import { RequestDetailHeaders } from './RequestDetailHeaders'
import { RequestDetailBody } from './RequestDetailBody'

type DetailTab = 'body' | 'headers' | 'params' | 'options'

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
  const editorFontSize = useUiSettingsStore((s) => s.editorFontSize)
  const [newHeaderKey, setNewHeaderKey] = useState('')
  const [newHeaderValue, setNewHeaderValue] = useState('')
  const [breakDialogOpen, setBreakDialogOpen] = useState(false)
  const [mapDialogOpen, setMapDialogOpen] = useState(false)
  const isPaused = useInterceptStore((s) => s.pauseState !== 'idle')
  const { addBreakpoint, startEditing: startBpEditing } = useBreakpointsStore()
  const { startEditing: startMapEditing } = useMappingsStore()

  const handleBreakSave = useCallback(async (name: string, urlPattern: string, folderId: string | null) => {
    const bp = await createBreakpoint(folderId, name, urlPattern, 'partial')
    addBreakpoint(bp)
    startBpEditing(bp, folderId)
    setBreakDialogOpen(false)
  }, [addBreakpoint, startBpEditing])

  const handleMapSave = useCallback(async (name: string, urlPattern: string, folderId: string | null) => {
    const mapping = await createMapping(folderId, name, urlPattern, 'partial')
    const store = useMappingsStore.getState()
    store.loadAll(store.folders, [...store.mappings, mapping])
    startMapEditing(mapping, folderId)
    setMapDialogOpen(false)
  }, [startMapEditing])

  const queryParams = useMemo(() => {
    if (!selectedRequest?.path) return []
    try {
      const search = selectedRequest.path.includes('?')
        ? selectedRequest.path.slice(selectedRequest.path.indexOf('?'))
        : ''
      return Array.from(new URLSearchParams(search).entries()).map(([key, value]) => ({ key, value }))
    } catch { return [] }
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
        <span className="text-xs text-app-muted font-mono truncate flex-1" title={fullUrl}>{fullUrl}</span>
        <CopyButton text={fullUrl} />
        <button type="button" onClick={() => openInFetch(selectedRequest)} className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors cursor-pointer" title="Open in Fetch tab">Open in Fetch</button>
        <button type="button" onClick={() => setMapDialogOpen(true)} className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors cursor-pointer" title="Add mapping for this URL">Add Mapping</button>
        {!isPaused && (
          <button type="button" onClick={() => setBreakDialogOpen(true)} className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer" title="Add breakpoint for this URL">Add Breakpoint</button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className={`px-2 py-0.5 rounded font-medium ${methodColor}`}>{selectedRequest.method}</span>
        {editMode ? (
          <input type="number" value={pendingMods.statusCode ?? selectedRequest.statusCode ?? ''} onChange={(e) => onModsChange?.({ statusCode: e.target.value ? Number(e.target.value) : undefined })} className="w-20 px-2 py-0.5 rounded border border-amber-500/50 bg-amber-900/20 text-amber-200 text-xs font-mono focus:outline-none focus:border-amber-400" placeholder="Status" min={100} max={599} aria-label="Status code" />
        ) : selectedRequest.isPending ? (
          <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 animate-pulse">Pending</span>
        ) : (
          selectedRequest.statusCode !== undefined && (
            <span className={`px-2 py-0.5 rounded ${getStatusBadgeClass(selectedRequest.statusCode)}`}>{selectedRequest.statusCode}</span>
          )
        )}
        {editMode ? (
          <input type="text" value={pendingMods.contentType ?? selectedRequest.contentType ?? ''} onChange={(e) => onModsChange?.({ contentType: e.target.value })} className="flex-1 min-w-0 px-2 py-0.5 rounded border border-amber-500/50 bg-amber-900/20 text-amber-200 text-xs font-mono focus:outline-none focus:border-amber-400" placeholder="Content-Type" aria-label="Content type" />
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
    <ViewerShell tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as DetailTab)} header={header} testId="intercept-detail-viewer">
      {activeTab === 'body' && (
        <RequestDetailBody selectedRequest={selectedRequest} editMode={editMode} pendingMods={pendingMods} onModsChange={onModsChange} editorFontSize={editorFontSize} />
      )}

      {activeTab === 'headers' && (
        <RequestDetailHeaders editMode={editMode} pendingMods={pendingMods} onModsChange={onModsChange} requestHeaders={requestHeaderEntries} responseHeaders={responseHeaderEntries} />
      )}

      {activeTab === 'params' && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {editMode ? (
            <div>
              {(pendingMods.queryParams ?? []).map(([k, v], i) => (
                <div key={i} className="flex gap-1 mb-1">
                  <input type="text" value={k} onChange={(e) => { const updated = (pendingMods.queryParams ?? []).map((pair, idx) => idx === i ? [e.target.value, pair[1]] as [string, string] : pair); onModsChange?.({ queryParams: updated }) }} className="w-2/5 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs font-mono text-app-primary focus:outline-none focus:border-amber-400" />
                  <input type="text" value={v} onChange={(e) => { const updated = (pendingMods.queryParams ?? []).map((pair, idx) => idx === i ? [pair[0], e.target.value] as [string, string] : pair); onModsChange?.({ queryParams: updated }) }} className="flex-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs text-app-primary focus:outline-none focus:border-amber-400" />
                  <button type="button" onClick={() => onModsChange?.({ queryParams: (pendingMods.queryParams ?? []).filter((_, idx) => idx !== i) })} className="shrink-0 text-red-400 hover:text-red-300 text-sm px-1.5 cursor-pointer" aria-label="Remove param">×</button>
                </div>
              ))}
              <div className="flex gap-1 mt-2">
                <input type="text" value={newHeaderKey} onChange={(e) => setNewHeaderKey(e.target.value)} placeholder="Param name" className="w-2/5 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs font-mono text-app-primary focus:outline-none focus:border-amber-400" />
                <input type="text" value={newHeaderValue} onChange={(e) => setNewHeaderValue(e.target.value)} placeholder="Value" className="flex-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs text-app-primary focus:outline-none focus:border-amber-400" />
                <button type="button" onClick={() => { if (!newHeaderKey.trim()) return; onModsChange?.({ queryParams: [...(pendingMods.queryParams ?? []), [newHeaderKey.trim(), newHeaderValue]] }); setNewHeaderKey(''); setNewHeaderValue('') }} className="shrink-0 px-2 py-0.5 bg-amber-700/60 hover:bg-amber-600/70 rounded text-xs text-white transition-colors cursor-pointer">Add</button>
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
    <SaveBreakpointDialog open={breakDialogOpen} onClose={() => setBreakDialogOpen(false)} onSave={handleBreakSave}
      defaultName={(() => { const s = selectedRequest.path.split('/').filter(Boolean); return s[s.length - 1] ?? selectedRequest.host; })()}
      defaultUrlPattern={fullUrl} />
    <SaveMappingDialog open={mapDialogOpen} onClose={() => setMapDialogOpen(false)} onSave={handleMapSave}
      defaultName={(() => { const s = selectedRequest.path.split('/').filter(Boolean); return s[s.length - 1] ?? selectedRequest.host; })()}
      defaultUrlPattern={fullUrl} />
    </>
  )
}

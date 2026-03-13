import { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Trash2 } from 'lucide-react'
import { useInterceptStore } from '@/stores/interceptStore'
import {
  columnDefs,
  formatTimestamp,
  formatMethod,
  formatHostPath,
  formatStatusCode,
  formatContentType,
  formatSize,
  filterRequests,
  HTTP_VERBS,
  STATUS_FILTERS,
  CopyButton,
} from './InterceptTable.utils'
import { openInFetch } from './openInFetch'

export function InterceptTable() {
  const requests = useInterceptStore((state) => state.requests)
  const clearRequests = useInterceptStore((state) => state.clearRequests)
  const selectedRequestId = useInterceptStore((state) => state.selectedRequestId)
  const setSelectedRequestId = useInterceptStore((state) => state.setSelectedRequestId)
  const searchQuery = useInterceptStore((state) => state.searchQuery)
  const searchMode = useInterceptStore((state) => state.searchMode)
  const verbFilter = useInterceptStore((state) => state.verbFilter)
  const statusFilter = useInterceptStore((state) => state.statusFilter)
  const setSearchQuery = useInterceptStore((state) => state.setSearchQuery)
  const setSearchMode = useInterceptStore((state) => state.setSearchMode)
  const setVerbFilter = useInterceptStore((state) => state.setVerbFilter)
  const setStatusFilter = useInterceptStore((state) => state.setStatusFilter)

  const hasItems = Array.isArray(requests) && requests.length > 0

  const filteredRequests = useMemo(
    () => filterRequests(requests, { searchQuery, searchMode, verbFilter, statusFilter }),
    [requests, searchQuery, searchMode, verbFilter, statusFilter]
  )

  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: filteredRequests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
    getItemKey: (index) => filteredRequests[index]?.id ?? index,
  })

  return (
    <div className="h-full flex flex-col min-h-0" data-testid="intercept-table-container">
      {/* Control bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-app-main border-b border-app-subtle shrink-0">
        <span className="text-xs text-app-muted">
          {hasItems ? `${filteredRequests.length} of ${requests.length} request${requests.length !== 1 ? 's' : ''}` : 'No requests'}
        </span>
        {hasItems && (
          <button
            onClick={clearRequests}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-app-muted hover:text-red-400 hover:bg-app-subtle rounded transition-colors"
            title="Clear all requests"
          >
            <Trash2 size={14} />
            Clear
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-app-main border-b border-app-subtle shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchMode === 'regex' ? 'Regex filter...' : 'Search...'}
          className="flex-1 bg-app-subtle border border-app-subtle rounded px-2 py-1 text-xs text-app-primary placeholder:text-app-muted outline-none focus:border-blue-500/50"
          aria-label="Search requests"
        />
        <button
          onClick={() => setSearchMode(searchMode === 'fuzzy' ? 'regex' : 'fuzzy')}
          className={`px-1.5 py-1 text-xs rounded transition-colors ${searchMode === 'regex' ? 'bg-blue-500/20 text-blue-400' : 'text-app-muted hover:bg-app-subtle'}`}
          title="Toggle regex mode"
          aria-label="Toggle regex mode"
        >
          .*
        </button>
        <select
          value={verbFilter ?? ''}
          onChange={(e) => setVerbFilter(e.target.value || null)}
          className="select-flat border-app-subtle bg-app-main text-app-primary h-8 rounded-md border pl-2 pr-7 text-xs"
          aria-label="Filter by method"
        >
          <option value="">All methods</option>
          {HTTP_VERBS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select
          value={statusFilter ?? ''}
          onChange={(e) => setStatusFilter(e.target.value || null)}
          className="select-flat border-app-subtle bg-app-main text-app-primary h-8 rounded-md border pl-2 pr-7 text-xs"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {hasItems && filteredRequests.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-app-muted text-sm">
          No requests match filters
        </div>
      )}

      {filteredRequests.length > 0 && (
        <>
          {/* Header */}
          <div className="w-full border-collapse flex-shrink-0">
            <div className="flex bg-app-main border-b border-app-subtle">
              {columnDefs.map((col) => (
                <div
                  key={col.id}
                  className="px-3 py-2 text-left text-xs font-medium text-app-secondary uppercase flex-1"
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          {/* Virtualized body */}
          <div
            ref={parentRef}
            className="flex-1 overflow-auto h-0"
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const req = filteredRequests[virtualRow.index]
                const fullUrl = formatHostPath(req.host, req.path)
                const isSelected = req.id === selectedRequestId
                return (
                  <div
                    key={req.id}
                    className={`group absolute w-full flex border-b border-app-subtle transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                        : 'hover:bg-app-subtle'
                    }`}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => setSelectedRequestId(req.id)}
                  >
                    <div className="px-3 py-2 text-xs text-app-muted flex-1 min-w-[100px]">
                      {formatTimestamp(req.timestamp)}
                    </div>
                    <div className="px-3 py-2 flex-1 min-w-[60px]">
                      {formatMethod(req.method)}
                    </div>
                    <div className="px-3 py-2 text-xs text-app-primary flex-1 min-w-[200px] max-w-[300px] flex items-center overflow-hidden gap-1">
                      <span className="truncate" title={fullUrl}>
                        {fullUrl}
                      </span>
                      <CopyButton text={fullUrl} />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openInFetch(req) }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 rounded px-1.5 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all"
                        title="Open in Fetch tab"
                      >
                        Fetch
                      </button>
                    </div>
                    <div className="px-3 py-2 flex-1 min-w-[70px]">
                      {formatStatusCode(req.statusCode)}
                    </div>
                    <div className="px-3 py-2 text-xs text-app-muted flex-1 min-w-[100px] max-w-[150px] overflow-hidden">
                      <span className="truncate block" title={req.contentType || ''}>
                        {formatContentType(req.contentType)}
                      </span>
                    </div>
                    <div className="px-3 py-2 text-xs text-app-muted flex-1 min-w-[60px]">
                      {formatSize(req.size)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {!hasItems && (
        <div className="flex-1 flex items-center justify-center text-app-muted">
          No intercepted requests yet
        </div>
      )}
    </div>
  )
}

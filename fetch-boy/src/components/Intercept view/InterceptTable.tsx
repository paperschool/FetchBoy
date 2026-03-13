import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Trash2, Copy, Check } from 'lucide-react'
import { useInterceptStore } from '@/stores/interceptStore'
import {
  columnDefs,
  formatTimestamp,
  formatMethod,
  formatHostPath,
  formatStatusCode,
  formatContentType,
  formatSize,
} from './InterceptTable.utils'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-1 p-0.5 hover:bg-app-subtle rounded transition-colors"
      title="Copy URL"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-app-muted" />}
    </button>
  )
}

export function InterceptTable() {
  const requests = useInterceptStore((state) => state.requests)
  const clearRequests = useInterceptStore((state) => state.clearRequests)
  
  const hasItems = Array.isArray(requests) && requests.length > 0

  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: requests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  })

  const handleClear = () => {
    clearRequests()
  }

  return (
    <div className="h-full flex flex-col min-h-0" data-testid="intercept-table-container">
      {/* Control bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-app-main border-b border-app-subtle shrink-0">
        <span className="text-xs text-app-muted">
          {hasItems ? `${requests.length} request${requests.length !== 1 ? 's' : ''}` : 'No requests'}
        </span>
        {hasItems && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-app-muted hover:text-red-400 hover:bg-app-subtle rounded transition-colors"
            title="Clear all requests"
          >
            <Trash2 size={14} />
            Clear
          </button>
        )}
      </div>

      {hasItems && (
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
                const req = requests[virtualRow.index]
                const fullUrl = formatHostPath(req.host, req.path)
                return (
                  <div
                    key={req.id}
                    className="absolute w-full flex border-b border-app-subtle hover:bg-app-subtle transition-colors cursor-pointer"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="px-3 py-2 text-xs text-app-muted flex-1 min-w-[100px]">
                      {formatTimestamp(req.timestamp)}
                    </div>
                    <div className="px-3 py-2 flex-1 min-w-[60px]">
                      {formatMethod(req.method)}
                    </div>
                    <div className="px-3 py-2 text-xs text-app-primary flex-1 min-w-[200px] max-w-[300px] flex items-center overflow-hidden">
                      <span className="truncate" title={fullUrl}>
                        {fullUrl}
                      </span>
                      <CopyButton text={fullUrl} />
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
        <div className="h-full flex items-center justify-center text-app-muted">
          No intercepted requests yet
        </div>
      )}
    </div>
  )
}

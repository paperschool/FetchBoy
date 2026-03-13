import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { InterceptRequest, BreakpointModifications } from '@/stores/interceptStore'

interface Props {
  request: InterceptRequest
  onConfirm: (modifications: BreakpointModifications) => void
  onCancel: () => void
}

export function RequestEditDialog({ request, onConfirm, onCancel }: Props) {
  const [statusCode, setStatusCode] = useState<string>(
    request.statusCode !== undefined ? String(request.statusCode) : ''
  )
  const [responseBody, setResponseBody] = useState(request.responseBody ?? '')
  const [contentType, setContentType] = useState(
    request.responseHeaders?.['content-type'] ?? ''
  )
  const [headers, setHeaders] = useState<[string, string][]>([])

  function addHeader() {
    setHeaders((prev) => [...prev, ['', '']])
  }

  function removeHeader(index: number) {
    setHeaders((prev) => prev.filter((_, i) => i !== index))
  }

  function updateHeader(index: number, field: 0 | 1, value: string) {
    setHeaders((prev) => {
      const next = [...prev]
      next[index] = [next[index][0], next[index][1]]
      next[index][field] = value
      return next
    })
  }

  function handleConfirm() {
    const code = parseInt(statusCode, 10)
    onConfirm({
      statusCode: statusCode.trim() && !isNaN(code) ? code : undefined,
      responseBody: responseBody || undefined,
      contentType: contentType || undefined,
      extraHeaders: headers.filter(([k]) => k.trim() !== ''),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Edit response before continuing"
    >
      <div className="bg-app-sidebar border border-app-subtle rounded-lg w-[560px] max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-app-subtle shrink-0">
          <h2 className="text-sm font-semibold text-app-inverse">Edit &amp; Continue</h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded text-app-muted hover:text-app-inverse transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status code */}
          <div>
            <label className="block text-xs font-medium text-app-secondary mb-1">
              Response Status Code
            </label>
            <input
              type="number"
              value={statusCode}
              onChange={(e) => setStatusCode(e.target.value)}
              placeholder="e.g. 200"
              className="w-32 bg-app-main border border-app-subtle rounded px-2 py-1.5 text-xs text-app-inverse outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Content-Type */}
          <div>
            <label className="block text-xs font-medium text-app-secondary mb-1">
              Content-Type
            </label>
            <input
              type="text"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              placeholder="e.g. application/json"
              className="w-full bg-app-main border border-app-subtle rounded px-2 py-1.5 text-xs text-app-inverse outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Response body */}
          <div>
            <label className="block text-xs font-medium text-app-secondary mb-1">
              Response Body
            </label>
            <textarea
              value={responseBody}
              onChange={(e) => setResponseBody(e.target.value)}
              rows={8}
              className="w-full bg-app-main border border-app-subtle rounded px-2 py-1.5 text-xs text-app-inverse font-mono outline-none focus:border-blue-500/50 resize-y"
              aria-label="Response body"
            />
          </div>

          {/* Extra headers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-app-secondary">
                Extra Headers
              </label>
              <button
                type="button"
                onClick={addHeader}
                className="flex items-center gap-1 text-xs text-app-muted hover:text-app-inverse transition-colors"
                aria-label="Add header"
              >
                <Plus size={12} /> Add
              </button>
            </div>

            {headers.length === 0 && (
              <p className="text-xs text-app-muted">No extra headers added.</p>
            )}

            {headers.map(([key, value], i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={key}
                  onChange={(e) => updateHeader(i, 0, e.target.value)}
                  placeholder="Header name"
                  className="flex-1 bg-app-main border border-app-subtle rounded px-2 py-1 text-xs text-app-inverse outline-none focus:border-blue-500/50"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateHeader(i, 1, e.target.value)}
                  placeholder="Value"
                  className="flex-1 bg-app-main border border-app-subtle rounded px-2 py-1 text-xs text-app-inverse outline-none focus:border-blue-500/50"
                />
                <button
                  type="button"
                  onClick={() => removeHeader(i)}
                  className="p-1 text-app-muted hover:text-red-400 transition-colors"
                  aria-label="Remove header"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-app-subtle shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-app-muted hover:text-app-inverse border border-app-subtle rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
          >
            Apply &amp; Continue
          </button>
        </div>
      </div>
    </div>
  )
}

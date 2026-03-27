import { useState } from 'react'
import { HeadersTable } from '@/components/ui/HeadersTable'
import type { BreakpointModifications } from '@/stores/interceptStore'

interface RequestDetailHeadersProps {
  editMode: boolean
  pendingMods: BreakpointModifications
  onModsChange?: (mods: Partial<BreakpointModifications>) => void
  requestHeaders: Array<{ key: string; value: string }>
  responseHeaders: Array<{ key: string; value: string }>
}

export function RequestDetailHeaders({
  editMode,
  pendingMods,
  onModsChange,
  requestHeaders,
  responseHeaders,
}: RequestDetailHeadersProps): React.ReactElement {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  if (!editMode) {
    return (
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div>
          <p className="text-xs font-medium text-app-secondary mb-2">Request Headers</p>
          <HeadersTable headers={requestHeaders} emptyMessage="No request headers" />
        </div>
        <div>
          <p className="text-xs font-medium text-app-secondary mb-2">Response Headers</p>
          <HeadersTable headers={responseHeaders} emptyMessage="No response headers" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
      <div>
        <p className="text-xs font-medium text-amber-400 mb-2">Response Headers</p>
        {(pendingMods.extraHeaders ?? []).map(([k, v], i) => (
          <div key={i} className="flex gap-1 mb-1">
            <input type="text" value={k}
              onChange={(e) => {
                const updated = (pendingMods.extraHeaders ?? []).map((pair, idx) =>
                  idx === i ? [e.target.value, pair[1]] as [string, string] : pair)
                onModsChange?.({ extraHeaders: updated })
              }}
              className="w-2/5 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs font-mono text-app-primary focus:outline-none focus:border-amber-400" />
            <input type="text" value={v}
              onChange={(e) => {
                const updated = (pendingMods.extraHeaders ?? []).map((pair, idx) =>
                  idx === i ? [pair[0], e.target.value] as [string, string] : pair)
                onModsChange?.({ extraHeaders: updated })
              }}
              className="flex-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs text-app-primary focus:outline-none focus:border-amber-400" />
            <button type="button"
              onClick={() => onModsChange?.({ extraHeaders: (pendingMods.extraHeaders ?? []).filter((_, idx) => idx !== i) })}
              className="shrink-0 text-red-400 hover:text-red-300 text-sm px-1.5" aria-label="Remove header">×</button>
          </div>
        ))}
        <div className="flex gap-1 mt-2">
          <input type="text" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Header name"
            className="w-2/5 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs font-mono text-app-primary focus:outline-none focus:border-amber-400" />
          <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value"
            className="flex-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-900/10 text-xs text-app-primary focus:outline-none focus:border-amber-400" />
          <button type="button"
            onClick={() => {
              if (!newKey.trim()) return
              onModsChange?.({ extraHeaders: [...(pendingMods.extraHeaders ?? []), [newKey.trim(), newValue]] })
              setNewKey(''); setNewValue('')
            }}
            className="shrink-0 px-2 py-0.5 bg-amber-700/60 hover:bg-amber-600/70 rounded text-xs text-white transition-colors">Add</button>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-app-secondary mb-2">Request Headers (read-only)</p>
          <HeadersTable headers={requestHeaders} emptyMessage="No request headers" />
        </div>
      </div>
    </div>
  )
}

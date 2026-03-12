import React from 'react'

export interface ColumnDef {
  id: string
  label: string
}

export const columnDefs: ColumnDef[] = [
  { id: 'timestamp', label: 'Timestamp' },
  { id: 'method', label: 'Method' },
  { id: 'hostPath', label: 'Host + Path' },
  { id: 'statusCode', label: 'Status Code' },
  { id: 'contentType', label: 'Content-Type' },
  { id: 'size', label: 'Size' },
]

export function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  const ms = d.getMilliseconds().toString().padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400',
  POST: 'bg-blue-500/20 text-blue-400',
  PUT: 'bg-orange-500/20 text-orange-400',
  PATCH: 'bg-yellow-500/20 text-yellow-400',
  DELETE: 'bg-red-500/20 text-red-400',
  HEAD: 'bg-gray-500/20 text-gray-400',
  OPTIONS: 'bg-purple-500/20 text-purple-400',
}

export function formatMethod(method: string): React.ReactElement {
  const colorClass = METHOD_COLORS[method.toUpperCase()] ?? 'bg-gray-500/20 text-gray-400'
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {method}
    </span>
  )
}

export function formatHostPath(host: string, path: string): string {
  return `${host}${path}`
}

export function formatStatusCode(statusCode?: number): React.ReactElement {
  if (!statusCode) return <span className="text-app-muted">—</span>
  let colorClass = 'text-app-muted'
  if (statusCode >= 200 && statusCode < 300) colorClass = 'text-green-400'
  else if (statusCode >= 300 && statusCode < 400) colorClass = 'text-blue-400'
  else if (statusCode >= 400 && statusCode < 500) colorClass = 'text-orange-400'
  else if (statusCode >= 500) colorClass = 'text-red-400'
  return <span className={colorClass}>{statusCode}</span>
}

export function formatContentType(contentType?: string): string {
  if (!contentType) return '—'
  // Strip parameters (e.g. "application/json; charset=utf-8" → "application/json")
  return contentType.split(';')[0].trim()
}

export function formatSize(size?: number): string {
  if (size === undefined || size === null) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

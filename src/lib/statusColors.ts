/** Badge-style classes (bg + text) for HTTP methods in intercept/detail views. */
export const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400',
  POST: 'bg-blue-500/20 text-blue-400',
  PUT: 'bg-orange-500/20 text-orange-400',
  PATCH: 'bg-yellow-500/20 text-yellow-400',
  DELETE: 'bg-red-500/20 text-red-400',
  HEAD: 'bg-gray-500/20 text-gray-400',
  OPTIONS: 'bg-purple-500/20 text-purple-400',
}

/** Badge-style classes (bg + text) for HTTP status codes in intercept/detail views. */
export function getStatusBadgeClass(code: number): string {
  if (code >= 200 && code < 300) return 'bg-green-500/20 text-green-400'
  if (code >= 300 && code < 400) return 'bg-blue-500/20 text-blue-400'
  if (code >= 400 && code < 500) return 'bg-yellow-500/20 text-yellow-400'
  if (code >= 500) return 'bg-red-500/20 text-red-400'
  return 'bg-gray-500/20 text-gray-400'
}

/** Text-only color class for HTTP status codes (ResponseViewer style). */
export function getStatusColorClass(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600'
  if (status >= 400 && status < 500) return 'text-yellow-600'
  if (status >= 500) return 'text-red-600'
  return 'text-app-primary'
}

/** Text-only color class for HTTP methods (HistoryPanel style). */
export function getMethodColorClass(method: string): string {
  const map: Record<string, string> = {
    GET: 'text-blue-400',
    POST: 'text-green-400',
    PUT: 'text-orange-400',
    PATCH: 'text-yellow-400',
    DELETE: 'text-red-400',
  }
  return map[method.toUpperCase()] ?? 'text-gray-400'
}

/** Status text-only color class for HistoryPanel. */
export function getHistoryStatusColorClass(status: number): string {
  if (status === 0) return 'text-gray-400'
  if (status < 300) return 'text-green-400'
  if (status < 400) return 'text-blue-400'
  if (status < 500) return 'text-yellow-400'
  return 'text-red-400'
}

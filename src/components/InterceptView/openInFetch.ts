import type { InterceptRequest } from '@/stores/interceptStore'
import { useTabStore, createDefaultRequestSnapshot } from '@/stores/tabStore'
import { useAppTabStore } from '@/stores/appTabStore'
import type { HttpMethod, KeyValueRow, BodyMode } from '@/stores/requestStore'

// Headers that are proxy/transport artifacts — not meaningful in the request builder.
const HOP_BY_HOP_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
])

const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

export function openInFetch(request: InterceptRequest): void {
  // Infer scheme: default https, downgrade to http if the host includes port 80
  const scheme = request.host.endsWith(':80') ? 'http' : 'https'
  const cleanHost = request.host.replace(/:443$/, '') // strip default HTTPS port

  // Split path from query string
  const qIdx = request.path.indexOf('?')
  const pathOnly = qIdx === -1 ? request.path : request.path.slice(0, qIdx)
  const search = qIdx === -1 ? '' : request.path.slice(qIdx)

  const url = `${scheme}://${cleanHost}${pathOnly}`

  // Parse query params
  const queryParams: KeyValueRow[] = Array.from(
    new URLSearchParams(search).entries()
  ).map(([key, value]) => ({ key, value, enabled: true }))

  // Filter and convert request headers
  const headers: KeyValueRow[] = Object.entries(request.requestHeaders ?? {})
    .filter(([key]) => !HOP_BY_HOP_HEADERS.has(key.toLowerCase()))
    .map(([key, value]) => ({ key, value, enabled: true }))

  const method = VALID_METHODS.has(request.method.toUpperCase())
    ? (request.method.toUpperCase() as HttpMethod)
    : 'GET'

  // Infer body mode from the request Content-Type header.
  const reqContentType = Object.entries(request.requestHeaders ?? {})
    .find(([k]) => k.toLowerCase() === 'content-type')?.[1]?.toLowerCase() ?? ''

  let bodyMode: BodyMode = 'none'
  if (request.requestBody) {
    if (reqContentType.includes('application/json')) bodyMode = 'json'
    else if (reqContentType.includes('application/x-www-form-urlencoded')) bodyMode = 'urlencoded'
    else bodyMode = 'raw'
  }

  const label = `${method} ${cleanHost}${pathOnly}`

  const snapshot = {
    ...createDefaultRequestSnapshot(),
    method,
    url,
    queryParams,
    headers,
    body: { mode: bodyMode, raw: request.requestBody ?? '' },
  }

  useTabStore.getState().openRequestInNewTab(snapshot, label, { openedFromIntercept: true })
  useAppTabStore.getState().setActiveTab('fetch')
}

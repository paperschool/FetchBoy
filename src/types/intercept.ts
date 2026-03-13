// src/types/intercept.ts
// Matches the camelCase JSON payload emitted by the Rust backend (Story 9.3)
// Must stay in sync with InterceptEvent struct in src-tauri/src/proxy.rs

export interface InterceptEventPayload {
  id: string
  timestamp: number                          // Unix timestamp in milliseconds (i64 from Rust)
  method: string                             // HTTP method (GET, POST, etc.)
  host: string                               // Hostname without protocol or port
  path: string                               // Full path including query string
  statusCode?: number                        // HTTP status code (optional — set by response handler)
  contentType?: string                       // Content-Type header value (optional)
  size?: number                              // Response body size in bytes (actual, not content-length)
  requestHeaders?: Record<string, string>    // All request headers
  requestBody?: string                       // Request body as UTF-8 string (text content types ≤1 MB only)
  responseHeaders?: Record<string, string>   // All response headers
  responseBody?: string                      // Response body as UTF-8 string (text content types ≤1 MB only)
  isBlocked?: boolean                        // True when request was blocked by a breakpoint
}

// Matches BreakpointPausedEvent struct in src-tauri/src/proxy.rs (Story 10.8)
export interface BreakpointPausedPayload {
  requestId: string
  breakpointId: string
  breakpointName: string
  timeoutAt: number                          // Unix timestamp in seconds
  method: string
  host: string
  path: string
  statusCode?: number
  responseBody?: string
  responseHeaders: Record<string, string>
  requestHeaders: Record<string, string>
  requestBody?: string
}

// src/types/intercept.ts
// Matches the camelCase JSON payload emitted by the Rust backend (Story 9.3)
// Must stay in sync with InterceptEvent struct in src-tauri/src/proxy.rs

export interface InterceptEventPayload {
  id: string
  timestamp: number      // Unix timestamp in milliseconds (i64 from Rust)
  method: string         // HTTP method (GET, POST, etc.)
  host: string           // Hostname without protocol or port
  path: string           // Full path including query string
  statusCode?: number    // HTTP status code (optional — set by response handler)
  contentType?: string   // Content-Type header value (optional)
  size?: number          // Response size in bytes (optional)
}

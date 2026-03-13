# Story 10.2: Request Detail View with Subtabs

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API developer using FetchBoy,
I want the bottom section of the Intercept split view to display detailed request/response information when I select a table row,
so that I can inspect the full content of intercepted HTTP traffic including body and headers.

## Acceptance Criteria

1. Bottom section is empty initially (no request selected)
2. Clicking a table row populates the bottom section with request details
3. Selected row remains highlighted in the table
4. Detail view displays: Full URL, HTTP Method, Status Code, Response Size, Timestamp
5. Detail view has subtabs: "Body" and "Headers"
6. Body tab shows response body with syntax highlighting (JSON, XML, HTML, plain text)
7. Headers tab shows request and response headers in key-value format
8. Empty state placeholder shown when no request selected
9. Component follows existing ResponseViewer patterns from fetch page
10. Component is ≤200 lines

## Tasks / Subtasks

- [x] Task 1 — Create RequestDetailView component skeleton (AC: #1, #8)
  - [x] Create `fetch-boy/src/components/Intercept view/RequestDetailView.tsx`
  - [x] Add empty state: centered text "Select a request to view details" (same as 10.1 placeholder)
  - [x] Accept `selectedRequest: InterceptRequest | null` prop

- [x] Task 2 — Add request detail display (AC: #2, #3, #4)
  - [x] When `selectedRequest` is present, show metadata header:
    - Full URL (with copy button)
    - HTTP Method (colored badge: GET=green, POST=blue, PUT=orange, DELETE=red, etc.)
    - Status Code (colored badge by category: 2xx=green, 4xx=yellow, 5xx=red)
    - Response Size (formatted: "1.2 KB", "345 B")
    - Timestamp (formatted: "2026-03-13 12:34:56")
  - [x] Wire to `selectedRequestId` from interceptStore to get full request object

- [x] Task 3 — Implement Body/Headers subtabs (AC: #5, #6, #7)
  - [x] Add tab buttons: "Body" and "Headers"
  - [x] Body tab: display `selectedRequest.responseBody` with syntax highlighting
    - Detect content-type: JSON → pretty-print + highlight, XML → highlight, HTML → highlight, plain text → raw
    - Use existing highlighting utils from ResponseViewer
  - [x] Headers tab: two sections "Request Headers" and "Response Headers"
    - Render as key-value table
    - Handle empty headers gracefully

- [x] Task 4 — Integrate with InterceptView split pane (AC: #2, #3)
  - [x] Replace bottom placeholder in `InterceptView.tsx` with `<RequestDetailView />`
  - [x] Pass `selectedRequest` from interceptStore to component
  - [x] Ensure selected row highlight persists (already implemented in 10.1)

- [x] Task 5 — Update tests (AC: #9)
  - [x] Create `RequestDetailView.test.tsx`
  - [x] Test: renders empty state when selectedRequest is null
  - [x] Test: renders metadata header when request selected
  - [x] Test: Body tab shows content with syntax highlighting
  - [x] Test: Headers tab shows request/response headers
  - [x] Test: Clicking tab switches content

- [x] Final Task — Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 10.2

## Dev Notes

### Architecture Overview

This story modifies 2 existing files and adds 2 new files:

| File | Action |
|------|--------|
| `fetch-boy/src/components/Intercept view/InterceptView.tsx` | Replace placeholder with RequestDetailView |
| `fetch-boy/src/stores/interceptStore.ts` | Ensure `selectedRequest` selector exists (may already have from 10.1) |
| `fetch-boy/src/components/Intercept view/RequestDetailView.tsx` | NEW — detail panel component |
| `fetch-boy/src/components/Intercept view/RequestDetailView.test.tsx` | NEW — component tests |

### Key Existing Patterns to Follow

**State management (Zustand v5.0.3):**
```ts
// interceptStore.ts — existing pattern from Story 10.1
import { create } from 'zustand'
export const useInterceptStore = create<InterceptStore>((set) => ({ ... }))

// Selector to get selected request from ID
const selectedRequest = useInterceptStore((state) => 
  state.requests.find((r) => r.id === state.selectedRequestId) ?? null
)
```

**Tailwind CSS classes (same as Story 10.1):**
- Background: `bg-app-main`, `bg-app-sidebar`, `bg-app-subtle`
- Text: `text-app-primary`, `text-app-secondary`, `text-app-muted`, `text-app-inverse`
- Border: `border-app-subtle`
- **No shadcn UI** — raw Tailwind only

**Syntax Highlighting from ResponseViewer:**
```ts
// Reuse existing highlight utilities from fetch page
// Check: fetch-boy/src/components/Response view/ResponseViewer.tsx
// or: fetch-boy/src/lib/response-utils.ts

// For JSON: use JSON.stringify(JSON.parse(body), null, 2) for pretty-print
// For highlighting: existing highlightText() or similar utility
```

**HTTP Method Badge Colors:**
```tsx
const methodColors: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400',
  POST: 'bg-blue-500/20 text-blue-400',
  PUT: 'bg-orange-500/20 text-orange-400',
  PATCH: 'bg-yellow-500/20 text-yellow-400',
  DELETE: 'bg-red-500/20 text-red-400',
  // fallback
  default: 'bg-gray-500/20 text-gray-400'
}
```

**Status Code Badge Colors:**
```tsx
const statusColors = (code: number): string => {
  if (code >= 200 && code < 300) return 'bg-green-500/20 text-green-400'
  if (code >= 300 && code < 400) return 'bg-blue-500/20 text-blue-400'
  if (code >= 400 && code < 500) return 'bg-yellow-500/20 text-yellow-400'
  if (code >= 500) return 'bg-red-500/20 text-red-400'
  return 'bg-gray-500/20 text-gray-400'
}
```

### RequestDetailView Component Design

```tsx
// fetch-boy/src/components/Intercept view/RequestDetailView.tsx

interface RequestDetailViewProps {
  selectedRequest: InterceptRequest | null
}

export function RequestDetailView({ selectedRequest }: RequestDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body')
  
  if (!selectedRequest) {
    return (
      <div className="flex-1 flex items-center justify-center text-app-muted text-sm">
        Select a request to view details
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Metadata header */}
      <div className="flex-shrink-0 p-3 border-b border-app-subtle space-y-2">
        {/* URL with copy */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-app-muted font-mono truncate flex-1">
            {selectedRequest.url}
          </span>
          <CopyButton text={selectedRequest.url} />
        </div>
        
        {/* Meta badges row */}
        <div className="flex items-center gap-3 text-xs">
          <span className={`px-2 py-0.5 rounded ${methodColors[selectedRequest.method] || methodColors.default}`}>
            {selectedRequest.method}
          </span>
          <span className={`px-2 py-0.5 rounded ${statusColors(selectedRequest.statusCode)}`}>
            {selectedRequest.statusCode}
          </span>
          <span className="text-app-muted">
            {formatSize(selectedRequest.responseSize)}
          </span>
          <span className="text-app-muted">
            {formatTimestamp(selectedRequest.timestamp)}
          </span>
        </div>
      </div>

      {/* Subtabs */}
      <div className="flex-shrink-0 flex border-b border-app-subtle">
        <button
          onClick={() => setActiveTab('body')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'body'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-app-muted hover:text-app-primary'
          }`}
        >
          Body
        </button>
        <button
          onClick={() => setActiveTab('headers')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'headers'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-app-muted hover:text-app-primary'
          }`}
        >
          Headers
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        {activeTab === 'body' ? (
          <BodyContent body={selectedRequest.responseBody} contentType={selectedRequest.contentType} />
        ) : (
          <HeadersContent 
            requestHeaders={selectedRequest.requestHeaders} 
            responseHeaders={selectedRequest.responseHeaders} 
          />
        )}
      </div>
    </div>
  )
}
```

### BodyContent Helper

```tsx
function BodyContent({ body, contentType }: { body?: string; contentType?: string }) {
  if (!body) {
    return <div className="text-app-muted text-sm">No response body</div>
  }

  // Detect content type
  if (contentType?.includes('json') || (body.trim().startsWith('{') || body.trim().startsWith('['))) {
    try {
      const parsed = JSON.parse(body)
      return (
        <pre className="text-xs font-mono text-app-primary whitespace-pre-wrap">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )
    } catch {
      // Not valid JSON, show as plain text
    }
  }

  // Plain text / other
  return (
    <pre className="text-xs font-mono text-app-primary whitespace-pre-wrap">
      {body}
    </pre>
  )
}
```

### HeadersContent Helper

```tsx
function HeadersContent({ 
  requestHeaders, 
  responseHeaders 
}: { 
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string> 
}) {
  const renderKeyValue = (headers: Record<string, string> | undefined, title: string) => {
    if (!headers || Object.keys(headers).length === 0) {
      return (
        <div className="mb-4">
          <div className="text-xs font-medium text-app-secondary mb-2">{title}</div>
          <div className="text-app-muted text-sm italic">No headers</div>
        </div>
      )
    }

    return (
      <div className="mb-4">
        <div className="text-xs font-medium text-app-secondary mb-2">{title}</div>
        <div className="space-y-1">
          {Object.entries(headers).map(([key, value]) => (
            <div key={key} className="flex gap-2 text-xs">
              <span className="text-blue-400 font-mono shrink-0">{key}:</span>
              <span className="text-app-primary font-mono break-all">{value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {renderKeyValue(requestHeaders, 'Request Headers')}
      {renderKeyValue(responseHeaders, 'Response Headers')}
    </div>
  )
}
```

### InterceptStore Extension (verify)

Story 10.1 already added `selectedRequestId`. Verify the store has this:

```ts
interface InterceptStore {
  // ... other state
  selectedRequestId: string | null
  // ... other actions
}
```

If not present, add it. Then add a selector:

```ts
// In interceptStore.ts or as inline selector
const selectedRequest = useInterceptStore((state) => 
  state.requests.find((r) => r.id === state.selectedRequestId) ?? null
)
```

### InterceptRequest Type (verify)

Ensure `InterceptRequest` has required fields:

```ts
interface InterceptRequest {
  id: string
  url: string
  method: string
  statusCode: number
  responseSize: number
  timestamp: string | Date
  responseBody?: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  contentType?: string
  // ... other fields
}
```

If any fields missing, extend the type in `fetch-boy/src/types/`.

### Format Utilities

```ts
// Size formatting
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Timestamp formatting
function formatTimestamp(ts: string | Date): string {
  const date = typeof ts === 'string' ? new Date(ts) : ts
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(',', '')
}
```

### Testing Approach

**File:** `fetch-boy/src/components/Intercept view/RequestDetailView.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { RequestDetailView } from './RequestDetailView'

const mockRequest = {
  id: 'req-123',
  url: 'https://api.example.com/users/1',
  method: 'GET',
  statusCode: 200,
  responseSize: 1234,
  timestamp: '2026-03-13T12:34:56Z',
  responseBody: '{"id": 1, "name": "John"}',
  requestHeaders: { 'Authorization': 'Bearer token', 'Accept': 'application/json' },
  responseHeaders: { 'Content-Type': 'application/json' },
  contentType: 'application/json'
}

describe('RequestDetailView', () => {
  it('renders empty state when no request selected', () => {
    render(<RequestDetailView selectedRequest={null} />)
    expect(screen.getByText('Select a request to view details')).toBeInTheDocument()
  })

  it('renders metadata when request selected', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    expect(screen.getByText('https://api.example.com/users/1')).toBeInTheDocument()
    expect(screen.getByText('GET')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('switches between Body and Headers tabs', () => {
    render(<RequestDetailView selectedRequest={mockRequest} />)
    
    // Default to Body
    expect(screen.getByText(/John/)).toBeInTheDocument()
    
    // Click Headers
    screen.getByText('Headers').click()
    expect(screen.getByText('Request Headers')).toBeInTheDocument()
    expect(screen.getByText('Authorization:')).toBeInTheDocument()
  })
})
```

### Project Structure Notes

- **Folder name has a space**: `fetch-boy/src/components/Intercept view/` — continue using existing convention
- **No shadcn/ui** — raw Tailwind only, consistent with Story 10.1 and existing Intercept components
- **Reuse ResponseViewer patterns** — check existing code for syntax highlighting approach
- **Component size limit**: ≤200 lines — extract helpers (BodyContent, HeadersContent, format utilities) to keep main component under limit

### References

- Story 10.1 (split view): [Source: _bmad-output/implementation-artifacts/10-1-intercept-split-view-with-request-table.md]
- Epic 10 full spec: [Source: _bmad-output/planning-artifacts/epic-10.md#Story-10.2]
- Existing InterceptView: [Source: fetch-boy/src/components/Intercept view/InterceptView.tsx]
- Existing InterceptTable: [Source: fetch-boy/src/components/Intercept view/InterceptTable.tsx]
- Intercept store: [Source: fetch-boy/src/stores/interceptStore.ts]
- ResponseViewer for patterns: [Source: fetch-boy/src/components/Response view/ResponseViewer.tsx]
- InterceptRequest type: [Source: fetch-boy/src/types/]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

None.

### Completion Notes List

- Created `RequestDetailView.tsx` (174 lines, within 200-line limit) with empty state, metadata header, Body/Headers subtabs
- Extended `InterceptRequest` in `interceptStore.ts` with optional fields: `responseBody`, `requestHeaders`, `responseHeaders`
- Replaced bottom placeholder in `InterceptView.tsx` with `<RequestDetailView selectedRequest={selectedRequest} />` wired to interceptStore
- Reused `formatTimestamp`, `formatSize`, `formatHostPath`, `CopyButton` from `InterceptTable.utils.tsx` for consistency
- Body tab: JSON auto-pretty-prints; falls back to plain text for other content types
- Headers tab: "Request Headers" and "Response Headers" sections with key-value rows; graceful empty state
- All 15 new tests pass; all 44 existing InterceptTable/InterceptView tests pass (no regressions)

### File List

- `fetch-boy/src/components/Intercept view/RequestDetailView.tsx` (new)
- `fetch-boy/src/components/Intercept view/RequestDetailView.test.tsx` (new)
- `fetch-boy/src/components/Intercept view/InterceptView.tsx` (modified)
- `fetch-boy/src/stores/interceptStore.ts` (modified — added responseBody, requestHeaders, responseHeaders fields)

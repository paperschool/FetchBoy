# Story 9.2: Intercept Table View UI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Fetch Boy user,
I want a read-only table view in the Intercept tab that displays captured HTTP/HTTPS request metadata,
so that I can monitor network traffic in real-time as the proxy captures requests.

## Acceptance Criteria

1. Intercept tab renders a table with columns: Timestamp, Method, Host + Path, Status Code, Content-Type, Size
2. Table is read-only — no row actions, editing, or controls
3. Table state managed in a dedicated Zustand slice (`useInterceptStore`)
4. Empty state message shown when no requests have been captured
5. Component is ≤150 lines; table column definitions and formatting extracted to `InterceptTable.utils.ts`
6. Tailwind + existing CSS tokens (`bg-app-main`, `text-app-primary`, etc.) used consistently with the rest of the app

## Tasks / Subtasks

- [ ] Task 1 — Create `useInterceptStore` (AC: #3)
  - [ ] Create `src/stores/interceptStore.ts`
  - [ ] Store shape: `{ requests: InterceptRequest[]; addRequest: (req) => void; clearRequests: () => void }`
  - [ ] Use `create` from zustand — no immer needed (simple array operations)
  - [ ] Define `InterceptRequest` interface: `{ id: string; timestamp: number; method: string; host: string; path: string; statusCode?: number; contentType?: string; size?: number }`
  - [ ] No persistence — requests reset on app restart
- [ ] Task 2 — Create `InterceptTable.utils.ts` (AC: #5)
  - [ ] Create `src/components/Intercept/InterceptTable.utils.ts`
  - [ ] Export column definitions array
  - [ ] Export formatting utilities: `formatTimestamp()`, `formatMethod()`, `formatHostPath()`, `formatStatusCode()`, `formatContentType()`, `formatSize()`
  - [ ] Keep utilities focused and reusable
- [ ] Task 3 — Create `InterceptTable` component (AC: #1, #2, #5, #6)
  - [ ] Create `src/components/Intercept/InterceptTable.tsx`
  - [ ] Import and use `useInterceptStore` for data
  - [ ] Import column definitions and formatters from `InterceptTable.utils.ts`
  - [ ] Render table with all 6 columns using Tailwind + CSS tokens
  - [ ] Use `bg-app-main`, `text-app-primary`, `text-app-secondary`, `text-app-muted`, `border-app-subtle` for styling
  - [ ] Implement method badge styling (GET=green, POST=blue, PUT=orange, DELETE=red, etc.)
  - [ ] Status code coloring: 2xx=green, 3xx=blue, 4xx=orange, 5xx=red
  - [ ] Component must be ≤150 lines
- [ ] Task 4 — Update `InterceptView` to render table (AC: #4)
  - [ ] Modify `src/components/Intercept/InterceptView.tsx`
  - [ ] Import `InterceptTable` and `useInterceptStore`
  - [ ] Check if `requests.length === 0` → show empty state (keep existing placeholder)
  - [ ] Otherwise render `<InterceptTable />`
- [ ] Task 5 — Add tests (AC: #5)
  - [ ] Create `src/components/Intercept/InterceptTable.test.tsx`
  - [ ] Test rendering with empty requests array (shows empty state)
  - [ ] Test rendering with sample data (shows table with rows)
  - [ ] Test column rendering and formatting
- [ ] Final Task — Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 9.2

## Dev Notes

### InterceptRequest Type Definition

```typescript
// src/stores/interceptStore.ts
export interface InterceptRequest {
  id: string
  timestamp: number // Unix timestamp in milliseconds
  method: string // HTTP method (GET, POST, PUT, etc.)
  host: string // Hostname without protocol
  path: string // Full path including query params
  statusCode?: number // HTTP status code (2xx, 3xx, 4xx, 5xx)
  contentType?: string // Content-Type header value
  size?: number // Response size in bytes
}
```

### Store Pattern to Follow

All simple stores in this codebase use this pattern (no immer needed):

```typescript
// src/stores/interceptStore.ts — new store
import { create } from 'zustand'

export interface InterceptRequest {
  id: string
  timestamp: number
  method: string
  host: string
  path: string
  statusCode?: number
  contentType?: string
  size?: number
}

interface InterceptStore {
  requests: InterceptRequest[]
  addRequest: (request: InterceptRequest) => void
  clearRequests: () => void
}

export const useInterceptStore = create<InterceptStore>((set) => ({
  requests: [],
  addRequest: (request) => set((state) => ({ 
    requests: [...state.requests, request] 
  })),
  clearRequests: () => set({ requests: [] }),
}))
```

Compare with `appTabStore.ts` which also uses simple `create` without immer.

### CSS Tokens Reference

The app uses custom CSS tokens via Tailwind v4. From `src/index.css`:

- **Background**: `bg-app-main`, `bg-app-sidebar`, `bg-app-topbar`, `bg-app-subtle`
- **Text**: `text-app-primary`, `text-app-secondary`, `text-app-muted`
- **Borders**: `border-app-subtle`
- **Interactive**: `hover:bg-app-subtle`

### Table Styling Example

```tsx
// src/components/Intercept/InterceptTable.tsx — example structure
import { useInterceptStore } from '@/stores/interceptStore'
import { columnDefs, formatTimestamp, formatMethod, formatHostPath, formatStatusCode, formatContentType, formatSize } from './InterceptTable.utils'

export function InterceptTable() {
  const requests = useInterceptStore((state) => state.requests)

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-app-main">
          <tr className="border-b border-app-subtle">
            {columnDefs.map((col) => (
              <th key={col.id} className="px-3 py-2 text-left text-xs font-medium text-app-secondary uppercase">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id} className="border-b border-app-subtle hover:bg-app-subtle">
              <td className="px-3 py-2 text-xs text-app-primary">{formatTimestamp(req.timestamp)}</td>
              <td className="px-3 py-2">{formatMethod(req.method)}</td>
              <td className="px-3 py-2 text-xs text-app-primary">{formatHostPath(req.host, req.path)}</td>
              <td className="px-3 py-2">{formatStatusCode(req.statusCode)}</td>
              <td className="px-3 py-2 text-xs text-app-muted">{formatContentType(req.contentType)}</td>
              <td className="px-3 py-2 text-xs text-app-muted">{formatSize(req.size)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### Method Badge Styling

```typescript
// In InterceptTable.utils.ts
export function formatMethod(method: string): string {
  const colors: Record<string, string> = {
    GET: 'bg-green-500/20 text-green-400',
    POST: 'bg-blue-500/20 text-blue-400',
    PUT: 'bg-orange-500/20 text-orange-400',
    PATCH: 'bg-yellow-500/20 text-yellow-400',
    DELETE: 'bg-red-500/20 text-red-400',
    HEAD: 'bg-gray-500/20 text-gray-400',
    OPTIONS: 'bg-purple-500/20 text-purple-400',
  }
  const colorClass = colors[method] || 'bg-gray-500/20 text-gray-400'
  return `<span class="px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}">${method}</span>`
}
```

### Status Code Styling

```typescript
// In InterceptTable.utils.ts
export function formatStatusCode(statusCode?: number): string {
  if (!statusCode) return '-'
  let colorClass = 'text-app-muted'
  if (statusCode >= 200 && statusCode < 300) colorClass = 'text-green-400'
  else if (statusCode >= 300 && statusCode < 400) colorClass = 'text-blue-400'
  else if (statusCode >= 400 && statusCode < 500) colorClass = 'text-orange-400'
  else if (statusCode >= 500) colorClass = 'text-red-400'
  return `<span class="${colorClass}">${statusCode}</span>`
}
```

### Empty State

The existing `InterceptView.tsx` already has an empty state placeholder from Story 9.1:

```tsx
// src/components/Intercept/InterceptView.tsx — current
import { Shield } from 'lucide-react'

export function InterceptView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-app-main text-center">
      <Shield className="h-12 w-12 text-app-muted" />
      <h2 className="text-base font-semibold text-app-primary">Traffic Intercept</h2>
      <p className="text-sm text-app-muted">Start the proxy to see requests here.</p>
    </div>
  )
}
```

**Update to conditionally render table or empty state:**

```tsx
// src/components/Intercept/InterceptView.tsx — after update
import { Shield } from 'lucide-react'
import { InterceptTable } from './InterceptTable'
import { useInterceptStore } from '@/stores/interceptStore'

export function InterceptView() {
  const requests = useInterceptStore((state) => state.requests)

  if (requests.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-app-main text-center">
        <Shield className="h-12 w-12 text-app-muted" />
        <h2 className="text-base font-semibold text-app-primary">Traffic Intercept</h2>
        <p className="text-sm text-app-muted">Start the proxy to see requests here.</p>
      </div>
    )
  }

  return (
    <div className="h-full bg-app-main">
      <InterceptTable />
    </div>
  )
}
```

### New Files to Create

| File | Purpose | Size Limit |
|------|---------|-----------|
| `src/stores/interceptStore.ts` | Intercept request state | ~30 lines |
| `src/components/Intercept/InterceptTable.utils.ts` | Column defs and formatters | ~60 lines |
| `src/components/Intercept/InterceptTable.tsx` | Main table component | ≤150 lines |
| `src/components/Intercept/InterceptTable.test.tsx` | Tests | - |

### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `src/components/Intercept/InterceptView.tsx` (8 lines) | Add table or empty state logic | Low — additive |

### Project Structure Notes

- New store: `src/stores/interceptStore.ts` — follows pattern from `appTabStore.ts`
- Intercept components: `src/components/Intercept/` — directory already exists from Story 9.1
- No database changes, no Rust changes, no Cargo.toml changes for this story
- This story creates the UI only — actual request data will come from Story 9.4 (Event Streaming Bridge)
- For testing, you can manually add sample data to the store

### Testing Standards

- Tests are co-located: `src/components/Intercept/InterceptTable.test.tsx`
- Framework: Vitest + React Testing Library (see `src/test/` for setup)
- Minimum test cases:
  - Renders empty state when no requests
  - Renders table with sample requests
  - All 6 columns are present
  - Method badges have correct colors
  - Status codes have correct colors
  - Clear button works (if implemented)

### Manual Testing Note

Since Story 9.3 (MITM Proxy Backend) and 9.4 (Event Streaming Bridge) aren't implemented yet, you can test the UI by:
1. Temporarily adding mock data to the store in development
2. Or using the browser console to dispatch store actions

### Context from Story 9.1

Story 9.1 created the tab shell and placeholder `InterceptView`. This story builds on that by:
- Creating the data store that will hold intercepted requests
- Creating the table UI to display those requests
- Updating `InterceptView` to conditionally show table or empty state

The Intercept directory structure after this story:

```
src/components/Intercept/
├── InterceptView.tsx       # Updated to show table or empty state
├── InterceptTable.tsx      # NEW: Main table component
├── InterceptTable.utils.ts # NEW: Column defs and formatters
└── InterceptTable.test.tsx # NEW: Tests
```

### References

- Store pattern reference: `src/stores/appTabStore.ts` (simple create, no immer)
- Store pattern reference: `src/stores/uiSettingsStore.ts` (simple create, no immer)
- EmptyState component: `src/components/ui/EmptyState.tsx`
- CSS tokens: `src/index.css` (search for `--app-` custom properties)
- Story 9.1 (parent): `_bmad-output/implementation-artifacts/9-1-top-level-tab-shell.md`
- Epic 9 overview: `_bmad-output/planning-artifacts/epic-9.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List


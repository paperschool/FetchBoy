# Story 10.1: Intercept Split View with Request Table

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API developer using FetchBoy,
I want the Intercept tab to show a horizontally split view with a filterable request table in the top section,
so that I can easily browse and search through captured traffic while the bottom section (Story 10.2) will later show request details.

## Acceptance Criteria

1. Intercept tab uses a horizontal split (top/bottom) layout with adjustable divider
2. Top section renders a table with columns: Timestamp, Method, Host + Path, Status Code, Content-Type, Size
3. Table supports fuzzy search filter (searches across URL, method, status)
4. Table supports regex search filter (toggle between fuzzy/regex mode)
5. Table supports HTTP verb filter dropdown (GET, POST, PUT, DELETE, PATCH, etc.)
6. Table supports status type filter (2xx, 3xx, 4xx, 5xx, or specific codes)
7. Table has a "Clear" button to reset all filters and clear captured requests
8. Selected row is highlighted in the table
9. Empty state message shown when no requests match filters
10. Component follows existing `InterceptTable` patterns (Tailwind CSS, no shadcn Table)
11. `InterceptTable` component is ≤200 lines; filter logic extracted to `InterceptTable.utils`
12. Bottom section shows a placeholder ("Select a request to view details") until Story 10.2

## Tasks / Subtasks

- [x] Task 1 — Extend `interceptStore` with filter + selection state (AC: #3, #4, #5, #6, #8)
  - [x] Add `selectedRequestId: string | null` + `setSelectedRequestId` to `InterceptStore`
  - [x] Add filter state: `searchQuery`, `searchMode: 'fuzzy' | 'regex'`, `verbFilter: string | null`, `statusFilter: string | null`
  - [x] Add `setSearchQuery`, `setSearchMode`, `setVerbFilter`, `setStatusFilter`, `clearFilters` actions
  - [x] `clearRequests` should also call `clearFilters` and reset `selectedRequestId`

- [x] Task 2 — Add filter utility functions to `InterceptTable.utils.tsx` (AC: #3, #4, #5, #6, #9)
  - [x] Add `filterRequests(requests, { searchQuery, searchMode, verbFilter, statusFilter })` function
  - [x] Fuzzy: case-insensitive `includes` check across `host + path`, `method`, `statusCode`
  - [x] Regex: attempt `new RegExp(searchQuery, 'i')` against same fields; fall back to empty if invalid regex
  - [x] Verb filter: exact match on `req.method.toUpperCase()`
  - [x] Status filter: match `'2xx'` → `>= 200 && < 300`, etc.; specific codes via string equality
  - [x] Export `HTTP_VERBS` and `STATUS_FILTERS` constant arrays for dropdown options

- [x] Task 3 — Refactor `InterceptTable.tsx` with filter bar (AC: #2, #3, #4, #5, #6, #7, #8, #9, #11)
  - [x] Add filter bar row above the table header (search input, regex toggle, verb dropdown, status dropdown)
  - [x] Wire filter UI to store actions
  - [x] Apply `filterRequests` before passing requests to virtualizer
  - [x] Show empty state ("No requests match filters") when filtered result is empty but `requests` has items
  - [x] Show original empty state ("No intercepted requests yet") when `requests` is empty
  - [x] Add `onClick` to each virtualised row → `setSelectedRequestId(req.id)`
  - [x] Highlight selected row: add `bg-app-subtle` (or `bg-blue-500/10 border-l-2 border-blue-500`) when `req.id === selectedRequestId`
  - [x] Keep component ≤200 lines

- [x] Task 4 — Implement split-pane layout in `InterceptView.tsx` (AC: #1, #12)
  - [x] Create `useSplitPane` hook in `fetch-boy/src/hooks/useSplitPane.ts` with mouse drag logic
  - [x] `InterceptView` replaces `<InterceptTable />` with a flex-column split container
  - [x] Top: `<InterceptTable />` with `flex-shrink-0` and dynamic `height` from split state
  - [x] Divider: a `4px` horizontal drag handle (`cursor-row-resize`, `bg-app-subtle hover:bg-blue-500/40`)
  - [x] Bottom: placeholder `<div>` with "Select a request to view details" centered muted text
  - [x] Default split: `60%` top / `40%` bottom, min `120px` each panel

- [x] Task 5 — Update tests (AC: #3, #4, #5, #6, #7, #8, #9)
  - [x] Update `InterceptTable.test.tsx`: add tests for filter bar rendering, fuzzy/regex search, verb filter, status filter, row selection highlight, "no match" empty state
  - [x] Add `filterRequests` unit tests to `InterceptTable.utils` describe block
  - [x] Ensure existing `InterceptView` tests still pass (update expectations if empty state message changes)

- [ ] Final Task — Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 10.1

## Dev Notes

### Architecture Overview

This story modifies 3 existing files and adds 2 new files:

| File | Action |
|------|--------|
| `fetch-boy/src/stores/interceptStore.ts` | Extend with filter state + `selectedRequestId` |
| `fetch-boy/src/components/Intercept view/InterceptTable.utils.tsx` | Add filter logic + constants |
| `fetch-boy/src/components/Intercept view/InterceptTable.tsx` | Add filter bar, row selection, filtered rendering |
| `fetch-boy/src/components/Intercept view/InterceptView.tsx` | Replace flat table with split-pane layout |
| `fetch-boy/src/hooks/useSplitPane.ts` | NEW — mouse-drag resizable pane hook |

### Key Existing Patterns to Follow

**State management (Zustand v5.0.3):**
```ts
// interceptStore.ts — existing pattern
import { create } from 'zustand'
export const useInterceptStore = create<InterceptStore>((set) => ({ ... }))
```
- Use `set((state) => ...)` for derived updates
- No `immer` middleware in this store (check before adding)
- `clearRequests` currently replaces requests with `[]` — extend to also clear filters

**Tailwind CSS classes:**
- Background: `bg-app-main`, `bg-app-sidebar`, `bg-app-subtle`
- Text: `text-app-primary`, `text-app-secondary`, `text-app-muted`, `text-app-inverse`
- Border: `border-app-subtle`
- **No shadcn UI** — project uses raw Tailwind only (no `cn()`, no `cva` in intercept components)

**Virtualization (TanStack Virtual v3.13.22):**
```ts
// InterceptTable.tsx — existing pattern, MUST preserve
const rowVirtualizer = useVirtualizer({
  count: filteredRequests.length,  // ← change from `requests` to `filteredRequests`
  getScrollElement: () => parentRef.current,
  estimateSize: () => 40,
  overscan: 5,
})
```
- The virtualizer `count` must use the **filtered** array length, not the raw array
- Virtual items use `absoluteposition` + `transform: translateY(...)` — keep this pattern

**Layout — `TabLayout` grid:**
```tsx
// InterceptView.tsx — existing
const mainContent = (
  <div className="h-full bg-app-main flex flex-col min-h-0">
    <InterceptTable />
  </div>
)
```
The split pane replaces the inner `<InterceptTable />`. The outer `div` keeps `h-full flex flex-col min-h-0` which is critical for proper grid height behaviour.

### `useSplitPane` Hook Design

No drag-resize library exists in the project. Implement a lightweight custom hook:

```ts
// fetch-boy/src/hooks/useSplitPane.ts
import { useRef, useState, useCallback } from 'react'

export function useSplitPane(defaultTopPercent = 60, minPx = 120) {
  const [topPercent, setTopPercent] = useState(defaultTopPercent)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const containerH = containerRef.current?.getBoundingClientRect().height ?? 0

    const onMove = (moveE: MouseEvent) => {
      const delta = moveE.clientY - startY
      const newTopPx = (topPercent / 100) * containerH + delta
      const clamped = Math.min(containerH - minPx, Math.max(minPx, newTopPx))
      setTopPercent((clamped / containerH) * 100)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [topPercent, minPx])

  return { containerRef, topPercent, onDividerMouseDown: onMouseDown }
}
```

Usage in `InterceptView.tsx`:
```tsx
const { containerRef, topPercent, onDividerMouseDown } = useSplitPane(60, 120)

const mainContent = (
  <div ref={containerRef} className="h-full bg-app-main flex flex-col min-h-0">
    <div style={{ height: `${topPercent}%` }} className="min-h-0 overflow-hidden">
      <InterceptTable />
    </div>
    <div
      className="h-1 bg-app-subtle hover:bg-blue-500/40 cursor-row-resize shrink-0 transition-colors"
      onMouseDown={onDividerMouseDown}
    />
    <div className="flex-1 min-h-0 flex items-center justify-center text-app-muted text-sm">
      Select a request to view details
    </div>
  </div>
)
```

### Filter Bar Design

Add a filter bar **above** the column headers inside `InterceptTable.tsx`. This bar sits between the control bar (count + Clear) and the column header row:

```tsx
{/* Filter bar */}
<div className="flex items-center gap-2 px-3 py-1.5 bg-app-main border-b border-app-subtle shrink-0">
  {/* Search input */}
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder={searchMode === 'regex' ? 'Regex filter...' : 'Search...'}
    className="flex-1 bg-app-subtle border border-app-subtle rounded px-2 py-1 text-xs text-app-primary placeholder:text-app-muted outline-none focus:border-blue-500/50"
  />
  {/* Regex toggle */}
  <button
    onClick={() => setSearchMode(searchMode === 'fuzzy' ? 'regex' : 'fuzzy')}
    className={`px-1.5 py-1 text-xs rounded transition-colors ${searchMode === 'regex' ? 'bg-blue-500/20 text-blue-400' : 'text-app-muted hover:bg-app-subtle'}`}
    title="Toggle regex mode"
  >
    .*
  </button>
  {/* Verb filter */}
  <select
    value={verbFilter ?? ''}
    onChange={(e) => setVerbFilter(e.target.value || null)}
    className="bg-app-subtle border border-app-subtle rounded px-2 py-1 text-xs text-app-muted outline-none"
  >
    <option value="">All methods</option>
    {HTTP_VERBS.map(v => <option key={v} value={v}>{v}</option>)}
  </select>
  {/* Status filter */}
  <select
    value={statusFilter ?? ''}
    onChange={(e) => setStatusFilter(e.target.value || null)}
    className="bg-app-subtle border border-app-subtle rounded px-2 py-1 text-xs text-app-muted outline-none"
  >
    <option value="">All statuses</option>
    {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
  </select>
</div>
```

### `filterRequests` Utility

```ts
// Add to InterceptTable.utils.tsx

export const HTTP_VERBS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export const STATUS_FILTERS = [
  { value: '2xx', label: '2xx Success' },
  { value: '3xx', label: '3xx Redirect' },
  { value: '4xx', label: '4xx Client Error' },
  { value: '5xx', label: '5xx Server Error' },
]

export interface FilterOptions {
  searchQuery: string
  searchMode: 'fuzzy' | 'regex'
  verbFilter: string | null
  statusFilter: string | null
}

export function filterRequests(
  requests: InterceptRequest[],
  { searchQuery, searchMode, verbFilter, statusFilter }: FilterOptions
): InterceptRequest[] {
  return requests.filter((req) => {
    // Verb filter
    if (verbFilter && req.method.toUpperCase() !== verbFilter) return false

    // Status filter
    if (statusFilter) {
      const code = req.statusCode ?? 0
      if (statusFilter === '2xx' && !(code >= 200 && code < 300)) return false
      if (statusFilter === '3xx' && !(code >= 300 && code < 400)) return false
      if (statusFilter === '4xx' && !(code >= 400 && code < 500)) return false
      if (statusFilter === '5xx' && !(code >= 500)) return false
      if (!['2xx','3xx','4xx','5xx'].includes(statusFilter) && String(code) !== statusFilter) return false
    }

    // Search filter
    if (searchQuery) {
      const haystack = `${req.method} ${formatHostPath(req.host, req.path)} ${req.statusCode ?? ''}`.toLowerCase()
      if (searchMode === 'regex') {
        try {
          return new RegExp(searchQuery, 'i').test(haystack)
        } catch {
          return false // invalid regex → show nothing
        }
      }
      return haystack.includes(searchQuery.toLowerCase())
    }

    return true
  })
}
```

### `interceptStore` Extension

Extend the store at `fetch-boy/src/stores/interceptStore.ts`:

```ts
interface InterceptStore {
  requests: InterceptRequest[]
  selectedRequestId: string | null
  searchQuery: string
  searchMode: 'fuzzy' | 'regex'
  verbFilter: string | null
  statusFilter: string | null

  addRequest: (request: InterceptRequest) => void
  clearRequests: () => void          // also clears filters + selection
  setSelectedRequestId: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setSearchMode: (mode: 'fuzzy' | 'regex') => void
  setVerbFilter: (verb: string | null) => void
  setStatusFilter: (status: string | null) => void
  clearFilters: () => void
}
```

`clearRequests` should reset filters and selection too — this is the expected UX when the user hits the Clear button in the control bar.

### Row Selection Highlight

```tsx
// In virtualised row, add conditional class:
className={`absolute w-full flex border-b border-app-subtle transition-colors cursor-pointer ${
  req.id === selectedRequestId
    ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
    : 'hover:bg-app-subtle'
}`}
onClick={() => setSelectedRequestId(req.id)}
```

The `border-l-2 border-l-blue-500` left accent is used for selected state — consistent with active-state patterns elsewhere in the codebase.

### Testing Approach

**File:** `fetch-boy/src/components/Intercept view/InterceptTable.test.tsx`

Add new describe blocks:
- `describe('Filter bar')` — renders search input, regex toggle, verb/status dropdowns
- `describe('filterRequests')` — unit tests for each filter type + combined filters
- `describe('Row selection')` — clicking row sets selectedRequestId, selected row has highlight class

**Mock updates:**
- The `useInterceptStore.setState(...)` pattern already works — extend with filter/selection state
- The virtualizer mock already handles `count` — just ensure count reflects filtered length

**Key test guard:**
- When `InterceptView` tests check for "No intercepted requests yet" — the text lives in `InterceptTable`, no change needed
- Add test: when requests exist but all filtered out, shows "No requests match filters" (different empty state)

### Project Structure Notes

- **Folder name has a space**: `fetch-boy/src/components/Intercept view/` — this is the existing convention, continue using it. Imports use `@/components/Intercept view/...` alias.
- **No shadcn/ui** in intercept components — the epic-10.md AC says "shadcn/ui Table patterns" but looking at the existing `InterceptTable.tsx` it uses raw Tailwind divs, not shadcn Table. **Follow the existing raw Tailwind pattern** — do NOT introduce shadcn Table.
- **`@tanstack/react-virtual` v3.13.22** is already installed — do not add new dependencies for the virtualized table.
- **No resizable pane library needed** — implement custom `useSplitPane` hook as described above. Adding `react-resizable-panels` would be overkill.
- **Tailwind v4** is used (`@tailwindcss/vite` plugin) — no `tailwind.config.js` needed; custom colors like `bg-app-main` are CSS variable-based.

### References

- Existing intercept table: [Source: fetch-boy/src/components/Intercept view/InterceptTable.tsx]
- Existing intercept store: [Source: fetch-boy/src/stores/interceptStore.ts]
- Existing format utilities: [Source: fetch-boy/src/components/Intercept view/InterceptTable.utils.tsx]
- Tab layout pattern: [Source: fetch-boy/src/components/Layout/TabLayout.tsx]
- InterceptView entry point: [Source: fetch-boy/src/components/Intercept view/InterceptView.tsx]
- Existing tests to update: [Source: fetch-boy/src/components/Intercept view/InterceptTable.test.tsx]
- Epic 10 full spec: [Source: _bmad-output/planning-artifacts/epic-10.md#Story-10.1]
- Package deps: [Source: fetch-boy/package.json]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Extended `interceptStore` with `selectedRequestId`, filter state (`searchQuery`, `searchMode`, `verbFilter`, `statusFilter`), and corresponding actions. `clearRequests` now resets all filters and selection.
- Added `filterRequests`, `HTTP_VERBS`, `STATUS_FILTERS`, `FilterOptions`, and `CopyButton` to `InterceptTable.utils.tsx`. Filter logic supports fuzzy (case-insensitive includes) and regex (with fallback to empty on invalid pattern) across method, host+path, and statusCode fields. Verb and status range filters are also supported.
- Refactored `InterceptTable.tsx` to add a filter bar (search input, regex toggle, verb dropdown, status dropdown) above column headers. Virtualizer now uses `filteredRequests.length`. Row click sets `selectedRequestId`; selected row gets `bg-blue-500/10 border-l-2 border-l-blue-500` highlight. Two empty states: "No intercepted requests yet" (empty requests) and "No requests match filters" (filtered-out). Component is 193 lines.
- Added `useSplitPane` hook with mouse-drag resize logic. Updated `InterceptView.tsx` to use split-pane layout: 60% top (InterceptTable) / drag divider / 40% bottom placeholder ("Select a request to view details").
- Updated `InterceptTable.test.tsx` with new describe blocks: Filter bar (rendering + fuzzy/regex/verb/status filtering), Row selection (click sets ID, highlight class), filterRequests unit tests, and split-pane placeholder test. All 601 non-pre-existing tests pass.

### File List

- `fetch-boy/src/stores/interceptStore.ts` (modified)
- `fetch-boy/src/components/Intercept view/InterceptTable.utils.tsx` (modified)
- `fetch-boy/src/components/Intercept view/InterceptTable.tsx` (modified)
- `fetch-boy/src/components/Intercept view/InterceptView.tsx` (modified)
- `fetch-boy/src/components/Intercept view/InterceptTable.test.tsx` (modified)
- `fetch-boy/src/hooks/useSplitPane.ts` (new)

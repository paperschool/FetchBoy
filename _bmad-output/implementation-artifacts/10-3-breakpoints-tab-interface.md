# Story 10.3: Breakpoints Tab Interface

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API developer using FetchBoy,
I want a Breakpoints tab in the sidebar (similar to Collections/History tabs) with folder structure support,
so that I can organize and manage HTTP request breakpoints for intercepting and debugging API traffic.

## Acceptance Criteria

1. Sidebar has a new "Breakpoints" tab alongside existing Collections/History tabs
2. Breakpoints tab renders with folder structure (accordion style) similar to Collections
3. Folders can be created, renamed, and deleted
4. Breakpoints can be created within folders
5. UI follows existing CollectionTree patterns
6. Empty state shown when no breakpoints exist
7. Tab is accessible from both Client and Intercept views
8. Component is ≤150 lines

## Tasks / Subtasks

- [x] Task 1 — Create BreakpointsStore for state management (AC: #1-8)
  - [x] Create `fetch-boy/src/stores/breakpointsStore.ts`
  - [x] Define `BreakpointFolder` and `Breakpoint` interfaces
  - [x] Implement Zustand store with folders[], breakpoints[], CRUD operations
  - [x] Add SQLite persistence (create new migration)

- [x] Task 2 — Create BreakpointsTree component (AC: #2-5, #8)
  - [x] Create `fetch-boy/src/components/Breakpoints/BreakpointsTree.tsx`
  - [x] Follow CollectionTree accordion patterns
  - [x] Implement folder create/rename/delete
  - [x] Implement breakpoint create/edit/delete
  - [x] Keep component ≤150 lines (extract helpers)

- [x] Task 3 — Integrate Breakpoints tab into Sidebar (AC: #1, #6, #7)
  - [x] Modify `fetch-boy/src/components/Sidebar/Sidebar.tsx` to add "Breakpoints" tab button
  - [x] Add "Breakpoints" tab in the tab bar (Collections | History | Breakpoints)
  - [x] Render `<BreakpointsTree />` when Breakpoints tab active
  - [x] Verify accessible from Client view (FetchView)

- [x] Task 4 — Integrate Breakpoints tab into InterceptSidebar (AC: #7)
  - [x] Modify `fetch-boy/src/components/Intercept view/InterceptSidebar.tsx` to add "Breakpoints" tab
  - [x] Ensure consistent UI between FetchView and InterceptView sidebars
  - [x] Share BreakpointsTree component between both sidebars

- [x] Task 5 — Create migration for breakpoints persistence (AC: #3-4)
  - [x] Create `fetch-boy/src-tauri/migrations/002_breakpoints.sql`
  - [x] Tables: `breakpoint_folders`, `breakpoints`
  - [x] Follow existing folder/collection table patterns

- [x] Task 6 — Add Rust backend commands for breakpoints CRUD (AC: #3-4)
  - [x] Add SQL functions in `db.rs` for breakpoints tables
  - [x] Add Tauri commands: `get_breakpoint_folders`, `create_breakpoint_folder`, `update_breakpoint_folder`, `delete_breakpoint_folder`
  - [x] Add Tauri commands: `get_breakpoints`, `create_breakpoint`, `update_breakpoint`, `delete_breakpoint`

- [x] Task 7 — Wire frontend store to backend (AC: #3-4)
  - [x] Connect breakpointsStore to Rust backend commands
  - [x] Load folders/breakpoints on app start
  - [x] Persist changes immediately

- [x] Task 8 — Add tests (AC: #5, #8)
  - [x] Create `BreakpointsTree.test.tsx`
  - [x] Test: empty state renders when no breakpoints
  - [x] Test: folder CRUD operations
  - [x] Test: breakpoint CRUD operations
  - [x] Test: accordion expand/collapse

- [x] Final Task — Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 10.3

## Dev Notes

### Architecture Overview

This story modifies/adds the following files:

| File | Action |
|------|--------|
| `fetch-boy/src/stores/breakpointsStore.ts` | NEW — Zustand store for breakpoints |
| `fetch-boy/src/components/Breakpoints/BreakpointsTree.tsx` | NEW — main breakpoints tree component |
| `fetch-boy/src/components/Breakpoints/FolderRow.tsx` | NEW — folder row component (reusable pattern) |
| `fetch-boy/src/components/Breakpoints/BreakpointRow.tsx` | NEW — breakpoint row component |
| `fetch-boy/src/components/Breakpoints/BreakpointsTree.test.tsx` | NEW — component tests |
| `fetch-boy/src/components/Sidebar/Sidebar.tsx` | MODIFIED — add Breakpoints tab |
| `fetch-boy/src/components/Intercept view/InterceptSidebar.tsx` | MODIFIED — add Breakpoints tab |
| `fetch-boy/src-tauri/migrations/002_breakpoints.sql` | NEW — SQLite migration |
| `fetch-boy/src-tauri/src/db.rs` | MODIFIED — add breakpoint SQL functions |
| `fetch-boy/src-tauri/src/lib.rs` | MODIFIED — add breakpoint Tauri commands |

### Key Existing Patterns to Follow

**State management (Zustand v5.0.3):**
```ts
// breakpointsStore.ts — follow collectionStore pattern
import { create } from 'zustand'

export interface BreakpointFolder {
  id: string
  name: string
  sortOrder: number
}

export interface Breakpoint {
  id: string
  folderId: string | null
  name: string
  urlPattern: string
  matchType: 'exact' | 'partial' | 'wildcard' | 'regex'
  enabled: boolean
  // Future: response mapping, status editing, blocking
}

interface BreakpointsStore {
  folders: BreakpointFolder[]
  breakpoints: Breakpoint[]
  // Actions: addFolder, updateFolder, deleteFolder, addBreakpoint, etc.
}

export const useBreakpointsStore = create<BreakpointsStore>((set) => ({ ... }))
```

**SQLite Migration Pattern:**
```sql
-- migrations/002_breakpoints.sql
CREATE TABLE IF NOT EXISTS breakpoint_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS breakpoints (
  id TEXT PRIMARY KEY,
  folder_id TEXT REFERENCES breakpoint_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url_pattern TEXT NOT NULL DEFAULT '',
  match_type TEXT NOT NULL DEFAULT 'partial',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Sidebar Tab Pattern (from Sidebar.tsx):**
```tsx
<div className="flex shrink-0 mb-3 rounded overflow-hidden border border-gray-700">
  <button
    type="button"
    onClick={() => setActivePanel('collections')}
    className={`flex-1 py-1.5 text-xs cursor-pointer ${
      activePanel === 'collections'
        ? 'bg-gray-700 text-app-inverse font-medium'
        : 'text-app-muted hover:text-app-inverse'
    }`}
  >
    Collections
  </button>
  <button
    type="button"
    onClick={() => setActivePanel('history')}
    className={`flex-1 py-1.5 text-xs cursor-pointer ${
      activePanel === 'history'
        ? 'bg-gray-700 text-app-inverse font-medium'
        : 'text-app-muted hover:text-app-inverse'
    }`}
  >
    History
  </button>
  {/* NEW: Breakpoints tab */}
  <button
    type="button"
    onClick={() => setActivePanel('breakpoints')}
    className={`flex-1 py-1.5 text-xs cursor-pointer ${
      activePanel === 'breakpoints'
        ? 'bg-gray-700 text-app-inverse font-medium'
        : 'text-app-muted hover:text-app-inverse'
    }`}
  >
    Breakpoints
  </button>
</div>
```

**Tailwind CSS classes (same as existing sidebar):**
- Background: `bg-app-sidebar`, `bg-app-main`, `bg-app-subtle`
- Text: `text-app-primary`, `text-app-secondary`, `text-app-muted`, `text-app-inverse`
- Border: `border-app-subtle`, `border-gray-700`
- **No shadcn UI** — raw Tailwind only

**Accordion/Folder Pattern (from CollectionTree/FolderRow):**
```tsx
// BreakpointsTree.tsx - simplified version without drag-drop
export function BreakpointsTree() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  
  const toggle = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="text-sm">
      {/* Header with Add Folder button */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-app-muted text-xs font-semibold uppercase tracking-widest">
          Breakpoints
        </span>
        <button
          onClick={() => void handleAddFolder()}
          aria-label="Add Folder"
          className="text-gray-300 hover:text-white p-1 rounded cursor-pointer"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Empty state */}
      {folders.length === 0 && breakpoints.length === 0 && (
        <EmptyState
          icon={Bug}
          label="No breakpoints yet — create a folder to get started"
          action={() => void handleAddFolder()}
          actionLabel="Create Folder"
        />
      )}

      {/* Tree */}
      {tree.map((folderNode) => (
        <FolderRow
          key={folderNode.folder.id}
          folder={folderNode.folder}
          breakpoints={folderNode.breakpoints}
          isExpanded={expanded[folderNode.folder.id]}
          onToggle={() => toggle(folderNode.folder.id)}
          // ... other props
        />
      ))}
    </div>
  )
}
```

**Breakpoint Type Definition:**
```ts
interface Breakpoint {
  id: string
  folderId: string | null  // null = root level
  name: string
  urlPattern: string       // URL pattern to match
  matchType: 'exact' | 'partial' | 'wildcard' | 'regex'
  enabled: boolean
  // Future fields (Stories 10.4-10.8):
  // - responseMapping?: { content: string, contentType: string }
  // - statusCode?: number
  // - requestHeaders?: Record<string, string>
  // - responseHeaders?: Record<string, string>
  // - blocked?: boolean
  // - blockStatusCode?: number
  // - blockResponse?: string
}

interface BreakpointFolder {
  id: string
  name: string
  sortOrder: number
}
```

### Component Design

**BreakpointsTree (≤150 lines):**
```tsx
// fetch-boy/src/components/Breakpoints/BreakpointsTree.tsx

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Bug } from 'lucide-react'  // breakpoint icon
import { FolderRow } from './FolderRow'
import { useBreakpointsStore } from '@/stores/breakpointsStore'

export function BreakpointsTree() {
  const { folders, breakpoints, addFolder, renameFolder, deleteFolder, addBreakpoint, deleteBreakpoint } = useBreakpointsStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  // Build tree structure: folder -> breakpoints
  const tree = folders.map(folder => ({
    folder,
    breakpoints: breakpoints.filter(bp => bp.folderId === folder.id)
  }))
  const rootBreakpoints = breakpoints.filter(bp => bp.folderId === null)

  const handleAddFolder = () => {
    const name = prompt('Folder name:')
    if (name) addFolder({ id: crypto.randomUUID(), name, sortOrder: folders.length })
  }

  if (folders.length === 0 && rootBreakpoints.length === 0) {
    return (
      <EmptyState
        icon={Bug}
        label="No breakpoints yet — create a folder to get started"
        action={handleAddFolder}
        actionLabel="Create Folder"
      />
    )
  }

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-app-muted text-xs font-semibold uppercase tracking-widest">
          Breakpoints
        </span>
        <button onClick={handleAddFolder} className="text-gray-300 hover:text-white p-1 rounded">
          <Plus size={16} />
        </button>
      </div>
      
      {/* Root-level breakpoints */}
      {rootBreakpoints.map(bp => (
        <BreakpointRow key={bp.id} breakpoint={bp} onDelete={() => deleteBreakpoint(bp.id)} />
      ))}

      {/* Folders with nested breakpoints */}
      {tree.map(({ folder, breakpoints: folderBps }) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          breakpoints={folderBps}
          isExpanded={expanded[folder.id]}
          onToggle={() => toggle(folder.id)}
          onDelete={() => deleteFolder(folder.id)}
          onAddBreakpoint={() => addBreakpoint({ 
            id: crypto.randomUUID(), 
            folderId: folder.id, 
            name: 'New Breakpoint', 
            urlPattern: '', 
            matchType: 'partial', 
            enabled: true 
          })}
        />
      ))}
    </div>
  )
}
```

**FolderRow Helper:**
```tsx
// Simplified from CollectionTree/FolderRow - no drag-drop for now
function FolderRow({ 
  folder, 
  breakpoints, 
  isExpanded, 
  onToggle, 
  onDelete,
  onAddBreakpoint 
}: FolderRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(folder.name)

  return (
    <div>
      <div className="flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-pointer">
        <button onClick={onToggle} className="text-app-muted">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <FolderIcon size={14} className="text-app-muted" />
        {isEditing ? (
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => setIsEditing(false)}
            className="flex-1 bg-gray-700 text-app-inverse text-sm outline-none px-1 rounded"
          />
        ) : (
          <span className="flex-1 text-app-inverse text-sm truncate">{folder.name}</span>
        )}
        <div className="hidden group-hover:flex gap-0.5">
          <button onClick={onAddBreakpoint} className="p-1 hover:text-white" title="Add Breakpoint">
            <Plus size={14} />
          </button>
          <button onClick={onDelete} className="p-1 text-red-400 hover:text-red-300" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="ml-4">
          {breakpoints.map(bp => (
            <BreakpointRow key={bp.id} breakpoint={bp} />
          ))}
        </div>
      )}
    </div>
  )
}
```

### Testing Approach

**File:** `fetch-boy/src/components/Breakpoints/BreakpointsTree.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { BreakpointsTree } from './BreakpointsTree'

// Mock the store
jest.mock('@/stores/breakpointsStore', () => ({
  useBreakpointsStore: () => ({
    folders: [{ id: 'f1', name: 'API Tests', sortOrder: 0 }],
    breakpoints: [{ id: 'b1', folderId: 'f1', name: 'Get Users', urlPattern: '*/api/users*', matchType: 'wildcard', enabled: true }],
    addFolder: jest.fn(),
    deleteFolder: jest.fn(),
    addBreakpoint: jest.fn(),
    deleteBreakpoint: jest.fn(),
  })
}))

describe('BreakpointsTree', () => {
  it('renders empty state when no breakpoints', () => {
    // Mock empty store
    render(<BreakpointsTree />)
    expect(screen.getByText(/No breakpoints yet/)).toBeInTheDocument()
  })

  it('renders folder with breakpoints', () => {
    render(<BreakpointsTree />)
    expect(screen.getByText('API Tests')).toBeInTheDocument()
    expect(screen.getByText('Get Users')).toBeInTheDocument()
  })

  it('expands/collapses folder on click', () => {
    render(<BreakpointsTree />)
    // Click chevron
    // Verify breakpoints shown/hidden
  })
})
```

### Project Structure Notes

- **New folder**: `fetch-boy/src/components/Breakpoints/` — create this directory
- **No shadcn/ui** — raw Tailwind only, consistent with existing components
- **Reuse EmptyState** from `@/components/ui/EmptyState`
- **Follow CollectionTree patterns** — but simplify (no drag-drop for this story)
- **Component size limit**: ≤150 lines for BreakpointsTree — extract helpers (FolderRow, BreakpointRow)
- **Accessibility**: Ensure keyboard navigation works for folder expand/collapse

### Backend Integration

**Rust Commands to Add:**
```rust
// src-tauri/src/lib.rs

#[tauri::command]
fn get_breakpoint_folders() -> Result<Vec<BreakpointFolder>, String> { ... }

#[tauri::command]
fn create_breakpoint_folder(name: String) -> Result<BreakpointFolder, String> { ... }

#[tauri::command]
fn update_breakpoint_folder(id: String, name: String) -> Result<(), String> { ... }

#[tauri::command]
fn delete_breakpoint_folder(id: String) -> Result<(), String> { ... }

#[tauri::command]
fn get_breakpoints() -> Result<Vec<Breakpoint>, String> { ... }

#[tauri::command]
fn create_breakpoint(folder_id: Option<String>, name: String, url_pattern: String, match_type: String) -> Result<Breakpoint, String> { ... }

#[tauri::command]
fn update_breakpoint(id: String, name: Option<String>, url_pattern: Option<String>, match_type: Option<String>, enabled: Option<bool>) -> Result<(), String> { ... }

#[tauri::command]
fn delete_breakpoint(id: String) -> Result<(), String> { ... }
```

### References

- Story 10.2 (detail view): [Source: _bmad-output/implementation-artifacts/10-2-request-detail-view-with-subtabs.md]
- Story 10.1 (split view): [Source: _bmad-output/implementation-artifacts/10-1-intercept-split-view-with-request-table.md]
- Epic 10 full spec: [Source: _bmad-output/planning-artifacts/epic-10.md#Story-10.3]
- Existing Sidebar: [Source: fetch-boy/src/components/Sidebar/Sidebar.tsx]
- Existing InterceptSidebar: [Source: fetch-boy/src/components/Intercept view/InterceptSidebar.tsx]
- Existing CollectionTree: [Source: fetch-boy/src/components/CollectionTree/CollectionTree.tsx]
- Existing FolderRow: [Source: fetch-boy/src/components/CollectionTree/FolderRow.tsx]
- Existing breakpointsStore: NEW (follow collectionStore pattern)
- Existing EmptyState: [Source: fetch-boy/src/components/ui/EmptyState.tsx]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

None — clean implementation.

### Completion Notes List

- Implemented `BreakpointFolder` and `Breakpoint` interfaces in `src/lib/db.ts` (shared with existing DB module)
- Created `src/lib/breakpoints.ts` with full CRUD using `@tauri-apps/plugin-sql` (same pattern as `collections.ts`)
- Created `src/stores/breakpointsStore.ts` — Zustand + immer store matching `collectionStore` pattern
- Created `002_breakpoints.sql` migration and registered it in `db.rs` as version 2
- Created `BreakpointsTree.tsx` (124 lines, ≤150 AC satisfied), `FolderRow.tsx`, `BreakpointRow.tsx`
- Added Breakpoints tab to `Sidebar.tsx` (Collections | History | Breakpoints)
- Added Breakpoints panel to `InterceptSidebar.tsx` with tab toggle
- All 7 component tests pass; 0 regressions introduced (3 pre-existing failures in appVersion/TourController unrelated to this story)
- Note: Tasks 6 & 7 re-implemented as frontend SQL pattern (same as all other stores) rather than Rust commands — consistent with the project architecture where `tauri-plugin-sql` is used directly from the frontend

### File List

- `fetch-boy/src/lib/db.ts` (modified — added BreakpointFolder and Breakpoint interfaces)
- `fetch-boy/src/lib/breakpoints.ts` (new — DB CRUD functions)
- `fetch-boy/src/stores/breakpointsStore.ts` (new)
- `fetch-boy/src/components/Breakpoints/BreakpointsTree.tsx` (new)
- `fetch-boy/src/components/Breakpoints/FolderRow.tsx` (new)
- `fetch-boy/src/components/Breakpoints/BreakpointRow.tsx` (new)
- `fetch-boy/src/components/Breakpoints/BreakpointsTree.test.tsx` (new)
- `fetch-boy/src/components/Sidebar/Sidebar.tsx` (modified)
- `fetch-boy/src/components/Intercept view/InterceptSidebar.tsx` (modified)
- `fetch-boy/src-tauri/migrations/002_breakpoints.sql` (new)
- `fetch-boy/src-tauri/src/db.rs` (modified)

### Change Log

- 2026-03-13: Story 10.3 implemented — Breakpoints tab interface with folder structure, Zustand store, SQLite persistence, integrated into both Sidebar and InterceptSidebar, 7 tests added

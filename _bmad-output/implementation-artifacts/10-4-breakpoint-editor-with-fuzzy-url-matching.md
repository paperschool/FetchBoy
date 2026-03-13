# Story 10.4: Breakpoint Editor with Fuzzy URL Matching

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API developer using FetchBoy,
I want a breakpoint editor with fuzzy URL matching capability,
so that I can create breakpoints that intercept HTTP requests based on flexible URL pattern matching.

## Acceptance Criteria

1. Selecting "New Breakpoint" or an existing breakpoint replaces the bottom split section with an editor
2. Editor contains a URL input field with fuzzy matching capability
3. URL input supports:
   - Exact URL matching
   - Partial URL matching (contains)
   - Wildcard patterns (e.g., `*/api/users/*`)
   - Regex patterns (toggleable)
4. Save button stores the breakpoint configuration
5. Cancel button discards changes and returns to detail view
6. Breakpoint configuration stored: id, name, folderId, urlPattern, matchType (exact/partial/wildcard/regex), enabled
7. Editor validates URL patterns before saving
8. Component is ≤150 lines

## Tasks / Subtasks

- [x] Task 1 — Update BreakpointsStore for editor state (AC: #1, #6)
  - [x] Add `selectedBreakpoint`, `isEditing`, `editForm` state to breakpointsStore.ts
  - [x] Add actions: selectBreakpoint, startEditing, cancelEditing, saveBreakpoint
  - [x] Add URL validation utilities (exact, partial, wildcard, regex)

- [x] Task 2 — Create BreakpointEditor component (AC: #2-4, #7, #8)
  - [x] Create `src/components/Breakpoints/BreakpointEditor.tsx`
  - [x] URL input field with matchType selector (dropdown or toggle buttons)
  - [x] Toggle between exact/partial/wildcard/regex modes
  - [x] Live preview of match test (show if URL would match)
  - [x] Save and Cancel buttons
  - [x] Keep component ≤150 lines (extract validation helpers)

- [x] Task 3 — Integrate editor into Intercept detail view (AC: #1)
  - [x] Modify Intercept detail section to show editor when editing
  - [x] Add "New Breakpoint" button in BreakpointsTree header
  - [x] Add "Edit" action on breakpoint row click

- [x] Task 4 — Implement URL matching logic in Rust (AC: #3)
  - [x] Add URL matching function to proxy.rs or new module
  - [x] Support exact, partial (contains), wildcard (* glob), regex
  - [x] Return match result for given URL and pattern

- [x] [Task 5 — Add validation UI (AC: #7)](file:///Users/dominicjomaa/Documents/Development/FetchBoyApp/_bmad-output/implementation-artifacts/10-3-breakpoints-tab-interface.md)
  - [x] Validate regex patterns are valid before saving
  - [x] Show validation error messages inline
  - [x] Test edge cases (empty pattern, invalid regex)

- [x] [Task 6 — Wire to backend persistence (AC: #6)](file:///Users/dominicjomaa/Documents/Development/FetchBoyApp/_bmad-output/implementation-artifacts/10-3-breakpoints-tab-interface.md)
  - [x] Connect saveBreakpoint to existing `update_breakpoint` Tauri command
  - [x] New breakpoints use `create_breakpoint` command
  - [x] Ensure folderId is preserved

- [x] [Task 7 — Add tests (AC: #8)](file:///Users/dominicjomaa/Documents/Development/FetchBoyApp/_bmad-output/implementation-artifacts/10-3-breakpoints-tab-interface.md)
  - [x] Test BreakpointEditor renders correctly
  - [x] Test URL matching: exact, partial, wildcard, regex
  - [x] Test validation errors shown for invalid patterns

- [x] Final Task — Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 10.4

## Dev Notes

### Architecture Overview

This story modifies/adds the following files:

| File | Action |
|------|--------|
| `src/stores/breakpointsStore.ts` | MODIFIED — add editor state and actions |
| `src/components/Breakpoints/BreakpointEditor.tsx` | NEW — main editor component |
| `src/components/Breakpoints/BreakpointEditor.test.tsx` | NEW — component tests |
| `src/components/Breakpoints/BreakpointRow.tsx` | MODIFIED — add edit action |
| `src/components/Breakpoints/BreakpointsTree.tsx` | MODIFIED — add new breakpoint button |
| `src/components/Intercept view/InterceptDetail.tsx` | MODIFIED — integrate editor |
| `src-tauri/src/proxy.rs` | MODIFIED — add URL matching function |
| `src-tauri/src/lib.rs` | MODIFIED — expose URL match command |

### BreakpointsStore Updates

```typescript
// breakpointsStore.ts — add editor state
interface BreakpointsStore {
  // ... existing state
  selectedBreakpointId: string | null
  isEditing: boolean
  editForm: {
    name: string
    urlPattern: string
    matchType: 'exact' | 'partial' | 'wildcard' | 'regex'
    enabled: boolean
  }
  
  // ... existing actions
  selectBreakpoint: (id: string | null) => void
  startEditing: (breakpoint?: Breakpoint) => void
  cancelEditing: () => void
  saveBreakpoint: () => Promise<void>
}
```

### URL Matching Types

```typescript
// Match types supported
type MatchType = 'exact' | 'partial' | 'wildcard' | 'regex'

// Examples:
// - exact: "https://api.example.com/users/123" matches exactly
// - partial: "api/users" matches any URL containing "api/users"
// - wildcard: "*/api/users/*" matches /foo/api/users/123, /bar/api/users
// - regex: "^/api/users/\\d+$" matches /api/users/123 but not /api/users/abc
```

### BreakpointEditor Component (≤150 lines)

```tsx
// src/components/Breakpoints/BreakpointEditor.tsx

import { useState, useEffect } from 'react'
import { useBreakpointsStore } from '@/stores/breakpointsStore'
import { X, Check, AlertCircle } from 'lucide-react'

interface Props {
  breakpoint?: Breakpoint
  folderId?: string | null
  onClose: () => void
}

export function BreakpointEditor({ breakpoint, folderId, onClose }: Props) {
  const { saveBreakpoint } = useBreakpointsStore()
  
  const [name, setName] = useState(breakpoint?.name ?? 'New Breakpoint')
  const [urlPattern, setUrlPattern] = useState(breakpoint?.urlPattern ?? '')
  const [matchType, setMatchType] = useState<MatchType>(breakpoint?.matchType ?? 'partial')
  const [enabled, setEnabled] = useState(breakpoint?.enabled ?? true)
  const [error, setError] = useState<string | null>(null)
  
  // Validate on change
  useEffect(() => {
    if (matchType === 'regex' && urlPattern) {
      try {
        new RegExp(urlPattern)
        setError(null)
      } catch (e) {
        setError('Invalid regex pattern')
      }
    } else {
      setError(null)
    }
  }, [urlPattern, matchType])
  
  const handleSave = async () => {
    if (error) return
    await saveBreakpoint({
      id: breakpoint?.id ?? crypto.randomUUID(),
      name,
      urlPattern,
      matchType,
      enabled,
      folderId: folderId ?? breakpoint?.folderId ?? null
    })
    onClose()
  }
  
  return (
    <div className="p-4 bg-app-sidebar border-t border-app-subtle">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-app-inverse font-medium">
          {breakpoint ? 'Edit Breakpoint' : 'New Breakpoint'}
        </h3>
        <button onClick={onClose} className="text-app-muted hover:text-app-inverse">
          <X size={18} />
        </button>
      </div>
      
      {/* Name input */}
      <div className="mb-3">
        <label className="block text-app-muted text-xs mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
        />
      </div>
      
      {/* URL Pattern input */}
      <div className="mb-3">
        <label className="block text-app-muted text-xs mb-1">URL Pattern</label>
        <input
          type="text"
          value={urlPattern}
          onChange={(e) => setUrlPattern(e.target.value)}
          placeholder={matchType === 'wildcard' ? '*/api/users/*' : 'https://api.example.com/...'}
          className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm font-mono"
        />
        {error && (
          <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}
      </div>
      
      {/* Match Type selector */}
      <div className="mb-3">
        <label className="block text-app-muted text-xs mb-1">Match Type</label>
        <div className="flex gap-1">
          {(['exact', 'partial', 'wildcard', 'regex'] as MatchType[]).map((type) => (
            <button
              key={type}
              onClick={() => setMatchType(type)}
              className={`px-3 py-1 text-xs rounded ${
                matchType === type
                  ? 'bg-app-accent text-white'
                  : 'bg-app-subtle text-app-muted hover:text-app-inverse'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Enabled toggle */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          id="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="enabled" className="text-app-inverse text-sm">Enabled</label>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-sm text-app-muted hover:text-app-inverse"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!!error || !urlPattern}
          className="px-4 py-1.5 text-sm bg-app-accent text-white rounded hover:bg-app-accent/80 disabled:opacity-50"
        >
          <Check size={14} className="inline mr-1" />
          Save
        </button>
      </div>
    </div>
  )
}
```

### Rust URL Matching

```rust
// src-tauri/src/proxy.rs — add URL matching

#[derive(Serialize)]
pub struct UrlMatchResult {
    pub matches: bool,
    pub matched_pattern: String,
}

pub fn match_url(url: &str, pattern: &str, match_type: &str) -> UrlMatchResult {
    let matches = match match_type {
        "exact" => url == pattern,
        "partial" => url.contains(pattern),
        "wildcard" => match_wildcard(url, pattern),
        "regex" => match_regex(url, pattern).unwrap_or(false),
        _ => false,
    };
    
    UrlMatchResult {
        matches,
        matched_pattern: pattern.to_string(),
    }
}

fn match_wildcard(url: &str, pattern: &str) -> bool {
    // Convert glob pattern to regex
    let regex_pattern = pattern
        .replace(".", "\\.")
        .replace("*", ".*");
    match Regex::new(&format!("^{}$", regex_pattern)) {
        Ok(re) => re.is_match(url),
        Err(_) => false,
    }
}

fn match_regex(url: &str, pattern: &str) -> Result<bool, regex::Error> {
    let re = Regex::new(pattern)?;
    Ok(re.is_match(url))
}
```

### Tailwind CSS Classes (same as existing)

- Background: `bg-app-sidebar`, `bg-app-main`, `bg-app-subtle`
- Text: `text-app-primary`, `text-app-secondary`, `text-app-muted`, `text-app-inverse`
- Border: `border-app-subtle`
- Accent: `bg-app-accent`
- No shadcn/ui — raw Tailwind only

### Integration with Intercept Detail View

The BreakpointEditor should replace the InterceptDetail content when:
1. User clicks "New Breakpoint" in BreakpointsTree header
2. User clicks "Edit" on an existing breakpoint row

```tsx
// In InterceptDetail.tsx
import { BreakpointEditor } from '@/components/Breakpoints/BreakpointEditor'
import { useBreakpointsStore } from '@/stores/breakpointsStore'

export function InterceptDetail() {
  const { selectedBreakpointId, isEditing, selectBreakpoint, cancelEditing } = useBreakpointsStore()
  
  // If editing, show editor
  if (isEditing) {
    return <BreakpointEditor onClose={cancelEditing} />
  }
  
  // Otherwise show request details (existing behavior)
  return <RequestDetailsContent />
}
```

### Testing Approach

**File:** `src/components/Breakpoints/BreakpointEditor.test.tsx`

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { BreakpointEditor } from './BreakpointEditor'

// Mock store
jest.mock('@/stores/breakpointsStore', () => ({
  useBreakpointsStore: () => ({
    saveBreakpoint: jest.fn(),
  })
}))

describe('BreakpointEditor', () => {
  it('renders new breakpoint form', () => {
    render(<BreakpointEditor onClose={jest.fn()} />)
    expect(screen.getByText('New Breakpoint')).toBeInTheDocument()
  })
  
  it('validates regex pattern', () => {
    render(<BreakpointEditor onClose={jest.fn()} />)
    const input = screen.getByPlaceholderText(/regex/)
    fireEvent.change(input, { target: { value: '[' } }) // Invalid regex
    expect(screen.getByText('Invalid regex pattern')).toBeInTheDocument()
  })
  
  it('calls save on save button click', async () => {
    const saveMock = jest.fn()
    // Mock store with saveMock
    render(<BreakpointEditor onClose={jest.fn()} />)
    fireEvent.click(screen.getByText('Save'))
    expect(saveMock).toHaveBeenCalled()
  })
})
```

### Project Structure Notes

- **New folder**: `src/components/Breakpoints/` — already exists from Story 10.3
- **No shadcn/ui** — raw Tailwind only
- **Component size limit**: ≤150 lines for BreakpointEditor
- **Validation**: Regex patterns validated client-side before save
- **URL matching**: Implemented in Rust for performance when intercepting

### Dependencies with Previous Stories

- **Story 10.3**: Creates breakpointsStore, BreakpointsTree, SQLite tables, Rust CRUD commands (this story builds on all of these)
- **Story 10.2**: Request detail view (editor integrates into this)
- **Story 9.3**: MITM proxy backend (URL matching will be added to proxy for actual interception)

### Backend Integration

The URL matching function will be called from the proxy's InterceptHandler to determine if a request matches any breakpoints.

```rust
// In proxy.rs — during request handling
for breakpoint in get_breakpoints()? {
    let result = match_url(
        &full_url, 
        &breakpoint.url_pattern, 
        &breakpoint.match_type
    );
    if result.matches && breakpoint.enabled {
        // Pause request, notify frontend, etc.
    }
}
```

### References

- Story 10.3 (previous): [Source: _bmad-output/implementation-artifacts/10-3-breakpoints-tab-interface.md]
- Story 10.2 (detail view): [Source: _bmad-output/implementation-artifacts/10-2-request-detail-view-with-subtabs.md]
- Story 10.1 (split view): [Source: _bmad-output/implementation-artifacts/10-1-intercept-split-view-with-request-table.md]
- Epic 10 full spec: [Source: _bmad-output/planning-artifacts/epic-10.md#Story-10.4]
- Existing BreakpointsTree: [Source: src/components/Breakpoints/BreakpointsTree.tsx]
- Existing breakpointsStore: [Source: src/stores/breakpointsStore.ts]
- Existing EmptyState: [Source: src/components/ui/EmptyState.tsx]
- MITM proxy (Story 9.3): [Source: _bmad-output/implementation-artifacts/9-3-mitm-proxy-backend.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed pre-existing proxy.rs test bug: `handler.pending.lock().unwrap()` → `handler.pending.is_none()` (pending is Option, not Mutex)
- Fixed partial match test: URL `https://api.example.com/users/123` doesn't contain substring `api/users` (dots in hostname) — updated test URL to `https://example.com/api/users/123`
- No `InterceptDetail.tsx` exists — editor integration was placed in `InterceptView.tsx` (the actual split-pane component)

### Completion Notes List

- Implemented `BreakpointsStore` editor state: `selectedBreakpointId`, `isEditing`, `editForm` fields with `startEditing`, `cancelEditing`, `saveBreakpoint` actions; `saveBreakpoint` handles both create (id=null) and update (id=string) paths via `@/lib/breakpoints`
- Created `BreakpointEditor.tsx` (144 lines ≤150 limit): reads from store `editForm`, supports all 4 match types, regex validation via `validateUrlPattern` utility exported from store
- Added "New Breakpoint" and "Add Folder" buttons to `BreakpointsTree` header; `handleAddBreakpoint(folderId)` now calls `startEditing` instead of directly creating
- Added `onEdit` prop to `BreakpointRow` (Pencil icon); `FolderRow` received `onEditBreakpoint` prop and passes it to each `BreakpointRow`
- `InterceptView.tsx` conditionally renders `BreakpointEditor` (when `isEditing`) or `RequestDetailView` in the bottom split pane
- Added `match_url`, `match_wildcard`, `match_regex` functions to `proxy.rs` with `UrlMatchResult` struct; exposed as `match_breakpoint_url` Tauri command in `lib.rs`; added `regex = "1"` to Cargo.toml
- 21 frontend tests in `BreakpointEditor.test.tsx` all pass; 11 new Rust URL matching tests all pass (24 total); TypeScript typecheck clean

### File List

- `src/stores/breakpointsStore.ts` (modified)
- `src/components/Breakpoints/BreakpointEditor.tsx` (new)
- `src/components/Breakpoints/BreakpointEditor.test.tsx` (new)
- `src/components/Breakpoints/BreakpointRow.tsx` (modified)
- `src/components/Breakpoints/BreakpointsTree.tsx` (modified)
- `src/components/Breakpoints/FolderRow.tsx` (modified)
- `src/components/Intercept view/InterceptView.tsx` (modified)
- `src-tauri/src/proxy.rs` (modified)
- `src-tauri/src/lib.rs` (modified)
- `src-tauri/Cargo.toml` (modified — added regex = "1")
- `_bmad-output/implementation-artifacts/10-4-breakpoint-editor-with-fuzzy-url-matching.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-03-13: Story 10.4 implemented — BreakpointEditor component with fuzzy URL matching; editor integrated into Intercept split view; URL matching logic in Rust (exact/partial/wildcard/regex); 21 frontend + 11 Rust tests added; all passing

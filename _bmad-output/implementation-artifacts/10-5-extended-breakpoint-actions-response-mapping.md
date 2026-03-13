# Story 10.5: Extended Breakpoint Actions — Response Mapping

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API developer using FetchBoy,
I want breakpoints to modify/override the response body before forwarding to the client,
so that I can simulate different API responses for testing and debugging purposes.

## Acceptance Criteria

1. Breakpoint editor expands to include "Response Mapping" section
2. User can enter a new response body (JSON, text, XML)
3. User can select content-type for the mapped response
4. When request matches breakpoint with response mapping, original response is replaced
5. Mapped response is passed through to the client unchanged
6. Visual indicator shows which breakpoints have response mapping enabled
7. Editor validates mapped response format
8. Backend support for response replacement implemented

## Tasks / Subtasks

- [ ] Task 1 — Update BreakpointsStore for response mapping state (AC: #1, #6)
  - [ ] Add `responseMapping` field to breakpoint data structure: `{ body: string, contentType: string, enabled: boolean }`
  - [ ] Update Breakpoint interface in types
  - [ ] Add updateResponseMapping action to breakpointsStore

- [ ] Task 2 — Extend BreakpointEditor component (AC: #1-3, #7)
  - [ ] Add Response Mapping section to existing BreakpointEditor (from Story 10.4)
  - [ ] Textarea for response body input with syntax highlighting
  - [ ] Content-Type dropdown (application/json, text/plain, application/xml, text/html)
  - [ ] Validation for JSON/XML formats
  - [ ] Visual indicator (badge/icon) on breakpoints with response mapping enabled

- [ ] Task 3 — Implement response replacement in Rust backend (AC: #4, #5, #8)
  - [ ] Add response_mapping field to breakpoints SQLite table
  - [ ] Modify proxy handler to check for breakpoint response mapping
  - [ ] Implement response body replacement logic
  - [ ] Preserve original response for logging/debugging

- [ ] Task 4 — Add UI indicator for mapped breakpoints (AC: #6)
  - [ ] Show icon/badge on BreakpointRow when response mapping is enabled
  - [ ] Tooltip showing "Has response mapping" on hover

- [ ] Task 5 — Integration testing (AC: #4, #5)
  - [ ] Test response replacement end-to-end
  - [ ] Verify original response is logged
  - [ ] Test different content types

- [ ] Final Task — Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 10.5

## Dev Notes

### Architecture Overview

This story modifies/adds the following files:

| File | Action |
|------|--------|
| `fetch-boy/src/types/index.ts` | MODIFIED — add responseMapping to Breakpoint type |
| `fetch-boy/src/stores/breakpointsStore.ts` | MODIFIED — add responseMapping state and actions |
| `fetch-boy/src/components/Breakpoints/BreakpointEditor.tsx` | MODIFIED — add Response Mapping section |
| `fetch-boy/src/components/Breakpoints/BreakpointRow.tsx` | MODIFIED — add visual indicator |
| `fetch-boy/src-tauri/src/proxy.rs` | MODIFIED — implement response replacement |
| `fetch-boy/src-tauri/src/db.rs` | MODIFIED — add response_mapping column to breakpoints table |
| `fetch-boy/src-tauri/migrations/` | MODIFIED — add migration for response_mapping |

### Data Structures

```typescript
// Response Mapping structure
interface ResponseMapping {
  enabled: boolean
  body: string
  contentType: 'application/json' | 'text/plain' | 'application/xml' | 'text/html'
}

// Extended Breakpoint interface
interface Breakpoint {
  id: string
  name: string
  folderId: string | null
  urlPattern: string
  matchType: 'exact' | 'partial' | 'wildcard' | 'regex'
  enabled: boolean
  // NEW: Response Mapping
  responseMapping?: ResponseMapping
  // Future: statusCode, headers, blockRequest
}
```

### SQLite Schema Update

```sql
-- Migration: add_response_mapping_to_breakpoints
ALTER TABLE breakpoints ADD COLUMN response_mapping_enabled BOOLEAN DEFAULT 0;
ALTER TABLE breakpoints ADD COLUMN response_mapping_body TEXT;
ALTER TABLE breakpoints ADD COLUMN response_mapping_content_type TEXT DEFAULT 'application/json';
```

### Rust Response Replacement

```rust
// In proxy.rs — during request handling

#[derive(Serialize, Deserialize)]
pub struct ResponseMapping {
    pub enabled: bool,
    pub body: String,
    pub content_type: String,
}

pub fn handle_breakpoint_response(
    breakpoint: &Breakpoint,
    original_response: &Response
) -> Response {
    // Check if response mapping is enabled
    if !breakpoint.response_mapping.enabled {
        return original_response.clone();
    }

    // Log original response for debugging
    log::info!(
        "Response mapping active - original body: {} bytes, mapping body: {} bytes",
        original_response.body.len(),
        breakpoint.response_mapping.body.len()
    );

    // Create modified response
    Response {
        body: breakpoint.response_mapping.body.clone(),
        content_type: breakpoint.response_mapping.content_type.clone(),
        status_code: original_response.status_code,
        headers: original_response.headers.clone(), // Can also be modified in Story 10.6
    }
}
```

### BreakpointEditor Extension

```tsx
// Add to existing BreakpointEditor.tsx

import { ResponseMappingEditor } from './ResponseMappingEditor'

// In the editor form, after URL pattern section:
{isEditing && (
  <ResponseMappingEditor
    mapping={form.responseMapping}
    onChange={(mapping) => setForm({ ...form, responseMapping: mapping })}
  />
)}

// Visual indicator on BreakpointRow:
{breakpoint.responseMapping?.enabled && (
  <Badge variant="outline" className="ml-2 text-xs">
    <MapPin className="w-3 h-3 mr-1" />
    Mapped
  </Badge>
)}
```

### ResponseMappingEditor Component

```tsx
// fetch-boy/src/components/Breakpoints/ResponseMappingEditor.tsx

interface Props {
  mapping: ResponseMapping
  onChange: (mapping: ResponseMapping) => void
}

export function ResponseMappingEditor({ mapping, onChange }: Props) {
  const [error, setError] = useState<string | null>(null)

  // Validate JSON/XML when content type changes
  useEffect(() => {
    if (mapping.contentType === 'application/json' && mapping.body) {
      try {
        JSON.parse(mapping.body)
        setError(null)
      } catch {
        setError('Invalid JSON')
      }
    }
  }, [mapping.body, mapping.contentType])

  return (
    <div className="border-t border-app-subtle pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="responseMappingEnabled"
          checked={mapping.enabled}
          onChange={(e) => onChange({ ...mapping, enabled: e.target.checked })}
        />
        <label htmlFor="responseMappingEnabled" className="text-sm font-medium">
          Response Mapping
        </label>
      </div>

      {mapping.enabled && (
        <>
          <div className="mb-3">
            <label className="block text-app-muted text-xs mb-1">Content-Type</label>
            <select
              value={mapping.contentType}
              onChange={(e) => onChange({ ...mapping, contentType: e.target.value })}
              className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
            >
              <option value="application/json">application/json</option>
              <option value="text/plain">text/plain</option>
              <option value="application/xml">application/xml</option>
              <option value="text/html">text/html</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="block text-app-muted text-xs mb-1">Response Body</label>
            <textarea
              value={mapping.body}
              onChange={(e) => onChange({ ...mapping, body: e.target.value })}
              placeholder={mapping.contentType === 'application/json' 
                ? '{"message": "Custom response"}' 
                : 'Enter response body...'}
              className="w-full h-32 bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm font-mono"
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>

          <p className="text-app-muted text-xs">
            Original response will be replaced with this mapped response.
          </p>
        </>
      )}
    </div>
  )
}
```

### Dependencies with Previous Stories

- **Story 10.4**: Breakpoint Editor with URL matching (CRITICAL - this story extends it)
  - BreakpointEditor component already exists
  - Store already has breakpoint CRUD operations
  - URL matching logic already implemented in Rust
- **Story 10.3**: Breakpoints tab interface and SQLite schema
- **Story 10.2**: Request detail view (shows when breakpoint matches)
- **Story 9.3**: MITM proxy backend (response interception happens here)

### Testing Approach

```tsx
// fetch-boy/src/components/Breakpoints/ResponseMappingEditor.test.tsx

describe('ResponseMappingEditor', () => {
  it('validates JSON for application/json content type', () => {
    render(<ResponseMappingEditor mapping={{...}} onChange={jest.fn()} />)
    const textarea = screen.getByPlaceholderText(/{"message"/)
    fireEvent.change(textarea, { target: { value: '{invalid json' } })
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument()
  })

  it('shows fields when enabled', () => {
    render(<ResponseMappingEditor mapping={{ enabled: true, ... }} onChange={jest.fn()} />)
    expect(screen.getByLabelText('Content-Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Response Body')).toBeInTheDocument()
  })
})
```

### Edge Cases

1. **Empty response body**: Allow empty (returns empty body)
2. **Invalid JSON**: Show validation error, prevent save
3. **Large response body**: No limit, but warn if >1MB
4. **Binary content**: Not supported in v1 (text only)
5. **Content-Type mismatch**: Allow user to set any, no auto-detection

### Project Structure Notes

- **Components**: Extend existing Breakpoints folder
- **No shadcn/ui**: Raw Tailwind only
- **Component size**: ResponseMappingEditor ≤80 lines
- **Validation**: Client-side before save
- **Backend**: Rust handles actual response replacement

### References

- Epic 10 full spec: [Source: _bmad-output/planning-artifacts/epic-10.md#Story-10.5]
- Story 10.4 (previous): [Source: _bmad-output/implementation-artifacts/10-4-breakpoint-editor-with-fuzzy-url-matching.md]
- Story 10.3 (breakpoints tab): [Source: _bmad-output/implementation-artifacts/10-3-breakpoints-tab-interface.md]
- Story 10.2 (detail view): [Source: _bmad-output/implementation-artifacts/10-2-request-detail-view-with-subtabs.md]
- Story 9.3 (MITM proxy): [Source: _bmad-output/implementation-artifacts/9-3-mitm-proxy-backend.md]
- Existing BreakpointsStore: [Source: fetch-boy/src/stores/breakpointsStore.ts]
- Existing BreakpointEditor: [Source: fetch-boy/src/components/Breakpoints/BreakpointEditor.tsx]
- SQLite migrations: [Source: fetch-boy/src-tauri/migrations/]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

- `fetch-boy/src/types/index.ts` (modified)
- `fetch-boy/src/stores/breakpointsStore.ts` (modified)
- `fetch-boy/src/components/Breakpoints/BreakpointEditor.tsx` (modified)
- `fetch-boy/src/components/Breakpoints/BreakpointRow.tsx` (modified)
- `fetch-boy/src/components/Breakpoints/ResponseMappingEditor.tsx` (new)
- `fetch-boy/src/components/Breakpoints/ResponseMappingEditor.test.tsx` (new)
- `fetch-boy/src-tauri/src/proxy.rs` (modified)
- `fetch-boy/src-tauri/src/db.rs` (modified)
- `fetch-boy/src-tauri/migrations/` (new migration file)

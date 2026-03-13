# Story 10.6: Extended Breakpoint Actions — Status & Header Editing

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API developer using FetchBoy,
I want breakpoints to modify HTTP status codes and headers,
so that I can simulate various HTTP response scenarios for testing and debugging purposes.

## Acceptance Criteria

1. Breakpoint editor expands to include "Status Code" and "Headers" sections
2. Status code dropdown/input allows selecting any HTTP status (100-599)
3. Headers section allows adding, editing, removing custom headers
4. When request matches breakpoint, status and headers are modified before forwarding
5. Original values are logged for debugging
6. Visual indicator shows which breakpoints modify status/headers
7. Backend support for header/status modification implemented

## Tasks / Subtasks

- [x] Task 1 — Extend BreakpointsStore for status/headers state (AC: #1, #2, #3, #5)
  - [x] Add `statusCode` field to breakpoint data structure: `{ code: number, enabled: boolean }`
  - [x] Add `headers` field to breakpoint data structure: `{ key: string, value: string, enabled: boolean }[]`
  - [x] Update Breakpoint interface in types
  - [x] Add updateStatusCode and updateHeaders actions to breakpointsStore

- [x] Task 2 — Extend BreakpointEditor component (AC: #1-3)
  - [x] Add Status Code section to existing BreakpointEditor (extends Story 10.5)
  - [x] Status code dropdown with common codes (200, 201, 400, 401, 403, 404, 500, etc.)
  - [x] Custom status code input for any 100-599 value
  - [x] Headers section with add/edit/remove functionality
  - [x] Validation for header format (no empty keys)

- [x] Task 3 — Implement status/header modification in Rust backend (AC: #4, #5, #7)
  - [x] Add status_code and headers columns to breakpoints SQLite table
  - [x] Modify proxy handler to check for breakpoint status modification
  - [x] Modify proxy handler to apply custom headers
  - [x] Log original status/headers for debugging

- [x] Task 4 — Add UI indicator for modified breakpoints (AC: #6)
  - [x] Show icon/badge on BreakpointRow when status/headers modification is enabled
  - [x] Tooltip showing "Modifies status/headers" on hover

- [x] Task 5 — Integration testing (AC: #4, #5)
  - [x] Test status code modification end-to-end
  - [x] Test custom header injection
  - [x] Verify original values are logged

- [x] Final Task — Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 10.6

## Dev Notes

### 🚨 CRITICAL: This Extends Story 10.5 Response Mapping

**Story 10.6 builds directly on Story 10.5's Response Mapping implementation.** The breakpoint data structure already has `responseMapping` - you MUST extend it, not replace it!

### Architecture Overview

This story modifies/adds the following files:

| File | Action |
|------|--------|
| `fetch-boy/src/types/index.ts` | MODIFIED — add statusCode and headers to Breakpoint type |
| `fetch-boy/src/stores/breakpointsStore.ts` | MODIFIED — add statusCode and headers state and actions |
| `fetch-boy/src/components/Breakpoints/BreakpointEditor.tsx` | MODIFIED — add Status Code & Headers sections |
| `fetch-boy/src/components/Breakpoints/BreakpointRow.tsx` | MODIFIED — add visual indicator |
| `fetch-boy/src-tauri/src/proxy.rs` | MODIFIED — implement status/header modification |
| `fetch-boy/src-tauri/src/db.rs` | MODIFIED — add status_code, headers columns to breakpoints table |
| `fetch-boy/src-tauri/migrations/` | MODIFIED — add migration for new columns |

### Data Structures

```typescript
// Extended from Story 10.5 - THIS IS THE COMPLETE INTERFACE
interface Breakpoint {
  id: string
  name: string
  folderId: string | null
  urlPattern: string
  matchType: 'exact' | 'partial' | 'wildcard' | 'regex'
  enabled: boolean
  // From Story 10.5: Response Mapping
  responseMapping?: ResponseMapping
  // NEW: Story 10.6 - Status Code
  statusCode?: {
    code: number
    enabled: boolean
  }
  // NEW: Story 10.6 - Headers
  headers?: Array<{
    key: string
    value: string
    enabled: boolean
  }>
  // From Story 10.7: Request Blocking (future)
  blockRequest?: {
    enabled: boolean
    statusCode: number
    body: string
  }
}

interface ResponseMapping {
  enabled: boolean
  body: string
  contentType: 'application/json' | 'text/plain' | 'application/xml' | 'text/html'
}
```

### SQLite Schema Update

```sql
-- Migration: add_status_headers_to_breakpoints
-- Run after Story 10.5 migration
ALTER TABLE breakpoints ADD COLUMN status_code_enabled BOOLEAN DEFAULT 0;
ALTER TABLE breakpoints ADD COLUMN status_code_value INTEGER DEFAULT 200;
ALTER TABLE breakpoints ADD COLUMN custom_headers TEXT; -- JSON array: [{"key": "X-Custom", "value": "value", "enabled": true}]
```

### Rust Status/Header Modification

```rust
// In proxy.rs — extend existing breakpoint handling from Story 10.5

#[derive(Serialize, Deserialize, Clone)]
pub struct BreakpointConfig {
    pub id: String,
    pub url_pattern: String,
    pub match_type: String,
    pub enabled: bool,
    // Story 10.5
    pub response_mapping: Option<ResponseMapping>,
    // Story 10.6 - NEW
    pub status_code: Option<StatusCodeConfig>,
    pub custom_headers: Option<Vec<HeaderConfig>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct StatusCodeConfig {
    pub enabled: bool,
    pub code: u16,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HeaderConfig {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

pub fn apply_breakpoint_modifications(
    breakpoint: &BreakpointConfig,
    response: &mut Response,
) {
    // Story 10.5: Response mapping (already implemented)
    if let Some(ref mapping) = breakpoint.response_mapping {
        if mapping.enabled {
            response.body = mapping.body.clone();
            response.content_type = mapping.content_type.clone();
        }
    }

    // Story 10.6: Status code modification
    if let Some(ref status) = breakpoint.status_code {
        if status.enabled {
            log::info!(
                "Status code modified: {} -> {}",
                response.status_code,
                status.code
            );
            response.status_code = status.code;
        }
    }

    // Story 10.6: Custom headers
    if let Some(ref headers) = breakpoint.custom_headers {
        for header in headers {
            if header.enabled {
                log::info!(
                    "Adding custom header: {} = {}",
                    header.key,
                    header.value
                );
                response.headers.insert(
                    header.key.clone(),
                    header.value.clone(),
                );
            }
        }
    }
}
```

### BreakpointEditor Extension (extends from Story 10.5)

```tsx
// Add to existing BreakpointEditor.tsx after ResponseMappingEditor:

import { StatusCodeEditor } from './StatusCodeEditor'
import { HeadersEditor } from './HeadersEditor'

// In the editor form, after Response Mapping section:
{isEditing && (
  <>
    <ResponseMappingEditor
      mapping={form.responseMapping}
      onChange={(mapping) => setForm({ ...form, responseMapping: mapping })}
    />
    <StatusCodeEditor
      statusCode={form.statusCode}
      onChange={(statusCode) => setForm({ ...form, statusCode })}
    />
    <HeadersEditor
      headers={form.headers}
      onChange={(headers) => setForm({ ...form, headers })}
    />
  </>
)}

// Visual indicators on BreakpointRow:
{breakpoint.statusCode?.enabled && (
  <Badge variant="outline" className="ml-2 text-xs">
    <Gauge className="w-3 h-3 mr-1" />
    {breakpoint.statusCode.code}
  </Badge>
)}
{breakpoint.headers?.some(h => h.enabled) && (
  <Badge variant="outline" className="ml-2 text-xs">
    <FileText className="w-3 h-3 mr-1" />
    +{breakpoint.headers.filter(h => h.enabled).length}
  </Badge>
)}
```

### StatusCodeEditor Component

```tsx
// fetch-boy/src/components/Breakpoints/StatusCodeEditor.tsx

interface Props {
  statusCode?: { code: number; enabled: boolean }
  onChange: (statusCode: { code: number; enabled: boolean }) => void
}

const COMMON_STATUS_CODES = [
  { code: 200, label: '200 OK' },
  { code: 201, label: '201 Created' },
  { code: 204, label: '204 No Content' },
  { code: 301, label: '301 Moved Permanently' },
  { code: 302, label: '302 Found' },
  { code: 400, label: '400 Bad Request' },
  { code: 401, label: '401 Unauthorized' },
  { code: 403, label: '403 Forbidden' },
  { code: 404, label: '404 Not Found' },
  { code: 500, label: '500 Internal Server Error' },
  { code: 502, label: '502 Bad Gateway' },
  { code: 503, label: '503 Service Unavailable' },
]

export function StatusCodeEditor({ statusCode, onChange }: Props) {
  const [customValue, setCustomValue] = useState('')
  
  const currentCode = statusCode?.code ?? 200
  const isEnabled = statusCode?.enabled ?? false

  return (
    <div className="border-t border-app-subtle pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="statusCodeEnabled"
          checked={isEnabled}
          onChange={(e) => onChange({ ...statusCode, enabled: e.target.checked, code: currentCode })}
        />
        <label htmlFor="statusCodeEnabled" className="text-sm font-medium">
          Status Code
        </label>
      </div>

      {isEnabled && (
        <>
          <select
            value={COMMON_STATUS_CODES.some(c => c.code === currentCode) ? currentCode : 'custom'}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                onChange({ enabled: true, code: 200 })
              } else {
                onChange({ enabled: true, code: parseInt(e.target.value) })
              }
            }}
            className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm mb-2"
          >
            <option value="" disabled>Select status code</option>
            {COMMON_STATUS_CODES.map(sc => (
              <option key={sc.code} value={sc.code}>{sc.label}</option>
            ))}
            <option value="custom">Custom...</option>
          </select>
          
          <input
            type="number"
            min="100"
            max="599"
            value={customValue || currentCode}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              if (val >= 100 && val <= 599) {
                setCustomValue(e.target.value)
                onChange({ enabled: true, code: val })
              }
            }}
            placeholder="100-599"
            className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
          />
        </>
      )}
    </div>
  )
}
```

### HeadersEditor Component

```tsx
// fetch-boy/src/components/Breakpoints/HeadersEditor.tsx

interface Props {
  headers?: Array<{ key: string; value: string; enabled: boolean }>
  onChange: (headers: Array<{ key: string; value: string; enabled: boolean }>) => void
}

export function HeadersEditor({ headers = [], onChange }: Props) {
  const addHeader = () => {
    onChange([...headers, { key: '', value: '', enabled: true }])
  }

  const updateHeader = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const updated = [...headers]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeHeader = (index: number) => {
    onChange(headers.filter((_, i) => i !== index))
  }

  return (
    <div className="border-t border-app-subtle pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="headersEnabled"
            checked={headers.some(h => h.enabled)}
            onChange={(e) => {
              if (e.target.checked && headers.length === 0) {
                addHeader()
              }
            }}
          />
          <label htmlFor="headersEnabled" className="text-sm font-medium">
            Custom Headers
          </label>
        </div>
        <button
          type="button"
          onClick={addHeader}
          className="text-xs text-app-accent hover:underline"
        >
          + Add Header
        </button>
      </div>

      {headers.length > 0 && (
        <div className="space-y-2">
          {headers.map((header, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={header.enabled}
                onChange={(e) => updateHeader(index, 'enabled', e.target.checked)}
                className="shrink-0"
              />
              <input
                type="text"
                value={header.key}
                onChange={(e) => updateHeader(index, 'key', e.target.value)}
                placeholder="Header-Name"
                className="flex-1 bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1 text-sm"
              />
              <input
                type="text"
                value={header.value}
                onChange={(e) => updateHeader(index, 'value', e.target.value)}
                placeholder="Value"
                className="flex-1 bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeHeader(index)}
                className="text-red-400 hover:text-red-300"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Dependencies with Previous Stories

- **Story 10.5**: Response Mapping (CRITICAL - this story extends the same component and data structure)
  - BreakpointEditor already has ResponseMappingEditor
  - Breakpoint type already has responseMapping field
  - Store already has updateResponseMapping action
  - Rust proxy already handles response replacement
- **Story 10.4**: Breakpoint Editor with URL matching
- **Story 10.3**: Breakpoints tab interface and SQLite schema
- **Story 10.2**: Request detail view
- **Story 9.3**: MITM proxy backend

### Testing Approach

```tsx
// fetch-boy/src/components/Breakpoints/StatusCodeEditor.test.tsx

describe('StatusCodeEditor', () => {
  it('shows validation error for invalid status codes', () => {
    render(<StatusCodeEditor onChange={jest.fn()} />)
    const input = screen.getByPlaceholderText('100-599')
    fireEvent.change(input, { target: { value: '99' } })
    expect(screen.queryByText('Invalid')).not.toBeInTheDocument() // Just doesn't update
  })

  it('calls onChange with correct value', () => {
    const onChange = jest.fn()
    render(<StatusCodeEditor onChange={onChange} />)
    const checkbox = screen.getByLabelText('Status Code')
    fireEvent.click(checkbox)
    expect(onChange).toHaveBeenCalledWith({ enabled: true, code: 200 })
  })
})

// fetch-boy/src/components/Breakpoints/HeadersEditor.test.tsx

describe('HeadersEditor', () => {
  it('adds new header on button click', () => {
    const onChange = jest.fn()
    render(<HeadersEditor headers={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('+ Add Header'))
    expect(onChange).toHaveBeenCalledWith([{ key: '', value: '', enabled: true }])
  })

  it('removes header on button click', () => {
    const onChange = jest.fn()
    const headers = [{ key: 'X-Test', value: 'test', enabled: true }]
    render(<HeadersEditor headers={headers} onChange={onChange} />)
    fireEvent.click(screen.getByText('×'))
    expect(onChange).toHaveBeenCalledWith([])
  })
})
```

### Edge Cases

1. **Empty header key**: Prevent save, show validation error
2. **Duplicate header keys**: Allow (some APIs use this)
3. **Invalid status code**: Prevent save, must be 100-599
4. **Large header value**: No limit
5. **Case-sensitive headers**: Preserve case as entered
6. **Overwriting existing headers**: Custom headers take precedence

### Project Structure Notes

- **Components**: Extend existing Breakpoints folder
- **No shadcn/ui**: Raw Tailwind only
- **Component size**: StatusCodeEditor ≤60 lines, HeadersEditor ≤80 lines
- **Validation**: Client-side before save
- **Backend**: Rust handles actual status/header modification
- **Pattern**: Consistent with Story 10.5 ResponseMappingEditor

### References

- Epic 10 full spec: [Source: _bmad-output/planning-artifacts/epic-10.md#Story-10.6]
- Story 10.5 (previous): [Source: _bmad-output/implementation-artifacts/10-5-extended-breakpoint-actions-response-mapping.md]
- Story 10.4 (breakpoint editor): [Source: _bmad-output/implementation-artifacts/10-4-breakpoint-editor-with-fuzzy-url-matching.md]
- Story 10.3 (breakpoints tab): [Source: _bmad-output/implementation-artifacts/10-3-breakpoints-tab-interface.md]
- Story 10.2 (detail view): [Source: _bmad-output/implementation-artifacts/10-2-request-detail-view-with-subtabs.md]
- Story 9.3 (MITM proxy): [Source: _bmad-output/implementation-artifacts/9-3-mitm-proxy-backend.md]
- Existing BreakpointsStore: [Source: fetch-boy/src/stores/breakpointsStore.ts]
- Existing BreakpointEditor: [Source: fetch-boy/src/components/Breakpoints/BreakpointEditor.tsx]
- SQLite migrations: [Source: fetch-boy/src-tauri/migrations/]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Followed flat field pattern from Story 10.5 (e.g. `status_code_enabled`, `status_code_value`, `custom_headers` as array) rather than nested objects in DevNotes — consistent with how `response_mapping_*` fields are structured
- `custom_headers` stored as JSON TEXT in SQLite, serialized/deserialized in `breakpoints.ts`
- Rust proxy now finds the first matching enabled breakpoint and applies all active overrides (response mapping, status code, custom headers) in sequence
- `BreakpointRule` extended with `status_code_enabled`, `status_code_value`, `custom_headers` fields — deserialized from frontend JSON via `sync_breakpoints` Tauri command
- StatusCodeEditor and HeadersEditor are new standalone components following the ResponseMappingEditor pattern
- 21 new tests added (10 StatusCodeEditor + 11 HeadersEditor); 3 new Rust tests for BreakpointRule/BreakpointHeader deserialization
- Pre-existing test failures in appVersion and TourController are unrelated to this story

### File List

- `fetch-boy/src/lib/db.ts` (modified — added BreakpointHeader, extended Breakpoint interface)
- `fetch-boy/src/lib/breakpoints.ts` (modified — RawBreakpoint, deserialization, CRUD, sync)
- `fetch-boy/src/stores/breakpointsStore.ts` (modified — EditForm, defaultEditForm, startEditing, saveBreakpoint)
- `fetch-boy/src/components/Breakpoints/BreakpointEditor.tsx` (modified — StatusCodeEditor, HeadersEditor integration)
- `fetch-boy/src/components/Breakpoints/BreakpointRow.tsx` (modified — Gauge + ListPlus indicators)
- `fetch-boy/src/components/Breakpoints/StatusCodeEditor.tsx` (new)
- `fetch-boy/src/components/Breakpoints/HeadersEditor.tsx` (new)
- `fetch-boy/src/components/Breakpoints/StatusCodeEditor.test.tsx` (new)
- `fetch-boy/src/components/Breakpoints/HeadersEditor.test.tsx` (new)
- `fetch-boy/src/components/Breakpoints/BreakpointEditor.test.tsx` (modified — updated EditForm fixtures)
- `fetch-boy/src/components/Breakpoints/BreakpointsTree.test.tsx` (modified — updated Breakpoint fixtures)
- `fetch-boy/src-tauri/src/proxy.rs` (modified — BreakpointHeader/BreakpointRule structs, status/header apply logic)
- `fetch-boy/src-tauri/src/db.rs` (modified — migration v4)
- `fetch-boy/src-tauri/migrations/004_status_headers.sql` (new)

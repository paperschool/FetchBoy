# Story 10.7: Extended Breakpoint Actions — Request Blocking

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API developer using FetchBoy,
I want breakpoints to completely block matching requests,
so that I can simulate API unavailability and test error handling in my client applications.

## Acceptance Criteria

1. Breakpoint editor includes a "Block Request" toggle
2. When enabled, matching requests are blocked (not forwarded to server)
3. Blocked requests return a configurable error to the client (default: 501 Not Implemented)
4. User can customize the block response status and body
5. Blocked requests are logged in the Intercept table with "BLOCKED" status
6. Visual indicator shows which breakpoints block requests
7. Backend support for request blocking implemented

## Tasks / Subtasks

- [ ] Task 1 — Extend BreakpointsStore for blocking state (AC: #1, #2, #3)
  - [ ] Add `blockRequest` field to breakpoint data structure: `{ enabled: boolean, statusCode: number, body: string }`
  - [ ] Update Breakpoint interface in types
  - [ ] Add updateBlockRequest action to breakpointsStore

- [ ] Task 2 — Extend BreakpointEditor component (AC: #1-3)
  - [ ] Add "Request Blocking" section to existing BreakpointEditor (extends Stories 10.5 & 10.6)
  - [ ] Toggle switch to enable/disable blocking
  - [ ] Status code dropdown (default: 501)
  - [ ] Custom body textarea for block response
  - [ ] Validation: ensure at least status code is set when enabled

- [ ] Task 3 — Implement request blocking in Rust backend (AC: #4, #5, #7)
  - [ ] Add block_request columns to breakpoints SQLite table
  - [ ] Modify proxy handler to check for blocking breakpoints BEFORE forwarding request
  - [ ] Return block response instead of forwarding when blocked
  - [ ] Emit "BLOCKED" event to frontend for logging

- [ ] Task 4 — Add UI indicator for blocking breakpoints (AC: #6)
  - [ ] Show icon/badge on BreakpointRow when blocking is enabled
  - [ ] Tooltip showing "Blocks requests" on hover

- [ ] Task 5 — Integration testing (AC: #4, #5)
  - [ ] Test request blocking end-to-end
  - [ ] Test custom status code and body
  - [ ] Verify "BLOCKED" status appears in Intercept table

- [ ] Final Task — Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 10.7

## Dev Notes

### 🚨 CRITICAL: This Extends Stories 10.5 and 10.6

**Story 10.7 builds directly on Stories 10.5 (Response Mapping) and 10.6 (Status & Header Editing).** The breakpoint data structure already has `responseMapping` and `statusCode`/`headers` - you MUST extend it, not replace it!

### Architecture Overview

This story modifies/adds the following files:

| File | Action |
|------|--------|
| `fetch-boy/src/lib/db.ts` | MODIFIED — add blockRequest to Breakpoint type |
| `fetch-boy/src/lib/breakpoints.ts` | MODIFIED — add blockRequest to create/update/deserialize |
| `fetch-boy/src/stores/breakpointsStore.ts` | MODIFIED — add blockRequest state and actions |
| `fetch-boy/src/components/Breakpoints/BreakpointEditor.tsx` | MODIFIED — add Blocking section |
| `fetch-boy/src/components/Breakpoints/BreakpointRow.tsx` | MODIFIED — add visual indicator |
| `fetch-boy/src-tauri/src/proxy.rs` | MODIFIED — implement request blocking logic |
| `fetch-boy/src-tauri/src/db.rs` | MODIFIED — add block_request columns |
| `fetch-boy/src-tauri/migrations/` | MODIFIED — add migration for new columns |

### Data Structures

```typescript
// Extended from Stories 10.5 & 10.6 - THIS IS THE COMPLETE INTERFACE
interface Breakpoint {
  id: string
  name: string
  folderId: string | null
  urlPattern: string
  matchType: 'exact' | 'partial' | 'wildcard' | 'regex'
  enabled: boolean
  // From Story 10.5: Response Mapping
  responseMapping?: ResponseMapping
  // From Story 10.6: Status Code & Headers
  statusCode?: {
    code: number
    enabled: boolean
  }
  headers?: Array<{
    key: string
    value: string
    enabled: boolean
  }>
  // NEW: Story 10.7 - Request Blocking
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
-- Migration: add_block_request_to_breakpoints
-- Run after Story 10.6 migration
ALTER TABLE breakpoints ADD COLUMN block_request_enabled BOOLEAN DEFAULT 0;
ALTER TABLE breakpoints ADD COLUMN block_request_status_code INTEGER DEFAULT 501;
ALTER TABLE breakpoints ADD COLUMN block_request_body TEXT DEFAULT '';
```

### CRITICAL: Rust Request Blocking Flow

The blocking MUST happen in `handle_request` BEFORE forwarding to the upstream server. Here's the flow:

```rust
// In proxy.rs — extend InterceptHandler to support blocking

impl HttpHandler for InterceptHandler {
    fn handle_request(
        &mut self,
        _ctx: &HttpContext,
        mut req: Request<Body>,
    ) -> impl std::future::Future<Output = RequestOrResponse> + Send {
        // ... existing code to capture request info ...

        let full_url = format!("{}://{}{}", 
            if req.uri().scheme_str().is_some() { "https" } else { "http" },
            host,
            path
        );

        // Check all enabled breakpoints for blocking
        // This requires loading breakpoints from DB or cache
        if let Some(blocking_bp) = check_for_blocking_breakpoint(&full_url).await {
            // Emit BLOCKED event to frontend
            let event = InterceptEvent {
                id: req_info.id.clone(),
                timestamp: req_info.timestamp,
                method: req_info.method,
                host: req_info.host,
                path: req_info.path,
                status_code: Some(blocking_bp.status_code), // e.g., 501
                // ... other fields ...
                response_body: Some(blocking_bp.body),
                is_blocked: true,  // NEW FIELD
            };
            emit_fn(&event);

            // Return block response instead of forwarding
            return RequestOrResponse::Response(
                Response::builder()
                    .status(blocking_bp.status_code)
                    .body(Body::empty())
                    .unwrap()
            );
        }

        // ... existing code to continue with normal proxy ...
        async move { RequestOrResponse::Request(req) }
    }
}
```

### BreakpointEditor Extension (extends from Stories 10.5 & 10.6)

```tsx
// Add to existing BreakpointEditor.tsx after HeadersEditor:

import { RequestBlockerEditor } from './RequestBlockerEditor'

// In the editor form, after Headers section:
{isEditing && (
  <>
    <ResponseMappingEditor ... />
    <StatusCodeEditor ... />
    <HeadersEditor ... />
    <RequestBlockerEditor
      blockRequest={form.blockRequest}
      onChange={(blockRequest) => setForm({ ...form, blockRequest })}
    />
  </>
)}

// Visual indicators on BreakpointRow:
{breakpoint.blockRequest?.enabled && (
  <Badge variant="outline" className="ml-2 text-xs text-red-400">
    <Ban className="w-3 h-3 mr-1" />
    Block
  </Badge>
)}
```

### RequestBlockerEditor Component

```tsx
// fetch-boy/src/components/Breakpoints/RequestBlockerEditor.tsx

interface Props {
  blockRequest?: {
    enabled: boolean
    statusCode: number
    body: string
  }
  onChange: (blockRequest: { enabled: boolean; statusCode: number; body: string }) => void
}

const DEFAULT_BLOCK_STATUS = 501

export function RequestBlockerEditor({ blockRequest, onChange }: Props) {
  const isEnabled = blockRequest?.enabled ?? false
  const statusCode = blockRequest?.statusCode ?? DEFAULT_BLOCK_STATUS
  const body = blockRequest?.body ?? ''

  return (
    <div className="border-t border-app-subtle pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="blockEnabled"
          checked={isEnabled}
          onChange={(e) => onChange({
            enabled: e.target.checked,
            statusCode: statusCode,
            body: body
          })}
        />
        <label htmlFor="blockEnabled" className="text-sm font-medium">
          Block Request
        </label>
        {isEnabled && (
          <Badge variant="destructive" className="ml-auto">
            <Ban className="w-3 h-3 mr-1" />
            Blocks traffic
          </Badge>
        )}
      </div>

      {isEnabled && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-app-muted mb-1 block">
              Block Response Status
            </label>
            <select
              value={statusCode}
              onChange={(e) => onChange({
                enabled: true,
                statusCode: parseInt(e.target.value),
                body: body
              })}
              className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
            >
              <option value="501">501 Not Implemented</option>
              <option value="403">403 Forbidden</option>
              <option value="404">404 Not Found</option>
              <option value="500">500 Internal Server Error</option>
              <option value="503">503 Service Unavailable</option>
              <option value="418">418 I'm a teapot</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-app-muted mb-1 block">
              Block Response Body (optional)
            </label>
            <textarea
              value={body}
              onChange={(e) => onChange({
                enabled: true,
                statusCode: statusCode,
                body: e.target.value
              })}
              placeholder='{"error": "This endpoint is blocked for testing"}'
              rows={3}
              className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm font-mono"
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

### InterceptEvent Extension for Blocking

```rust
// In proxy.rs - extend InterceptEvent

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterceptEvent {
    // ... existing fields ...
    pub is_blocked: Option<bool>,  // NEW: true when request was blocked
    pub original_status_code: Option<u16>,  // NEW: if modified before blocking
}
```

### Dependencies with Previous Stories

- **Story 10.6**: Status & Header Editing (CRITICAL - extends same component and data structure)
  - BreakpointEditor already has StatusCodeEditor and HeadersEditor
  - Breakpoint type already has statusCode and headers fields
  - Store already has updateStatusCode and updateHeaders actions
  - Rust proxy already handles status/header modification
- **Story 10.5**: Response Mapping (extends BreakpointEditor)
- **Story 10.4**: Breakpoint Editor with URL matching
- **Story 10.3**: Breakpoints tab interface and SQLite schema
- **Story 10.2**: Request detail view
- **Story 9.3**: MITM proxy backend

### Testing Approach

```tsx
// fetch-boy/src/components/Breakpoints/RequestBlockerEditor.test.tsx

describe('RequestBlockerEditor', () => {
  it('shows block toggle unchecked by default', () => {
    render(<RequestBlockerEditor onChange={jest.fn()} />)
    const checkbox = screen.getByLabelText('Block Request')
    expect(checkbox).not.toBeChecked()
  })

  it('calls onChange with default values when enabled', () => {
    const onChange = jest.fn()
    render(<RequestBlockerEditor onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Block Request'))
    expect(onChange).toHaveBeenCalledWith({
      enabled: true,
      statusCode: 501,
      body: ''
    })
  })

  it('persists values when toggling off and on', () => {
    const onChange = jest.fn()
    const { rerender } = render(
      <RequestBlockerEditor 
        onChange={onChange} 
        blockRequest={{ enabled: true, statusCode: 403, body: 'blocked' }}
      />
    )
    
    // Disable
    fireEvent.click(screen.getByLabelText('Block Request'))
    expect(onChange).toHaveBeenCalledWith({
      enabled: false,
      statusCode: 403,
      body: 'blocked'
    })
  })

  it('shows all status code options when enabled', () => {
    render(<RequestBlockerEditor 
      onChange={jest.fn()} 
      blockRequest={{ enabled: true, statusCode: 501, body: '' }}
    />)
    
    expect(screen.getByText('501 Not Implemented')).toBeInTheDocument()
    expect(screen.getByText('403 Forbidden')).toBeInTheDocument()
    expect(screen.getByText('404 Not Found')).toBeInTheDocument()
  })
})
```

### Edge Cases

1. **Multiple blocking breakpoints**: First match wins (consistent with other breakpoint actions)
2. **Empty block body**: Return empty body with just status code
3. **Invalid status code**: Prevent save, must be 100-599
4. **Blocking + response mapping**: Blocking takes precedence (don't forward at all)
5. **Blocking + status/header modification**: Blocking takes precedence (return block response)
6. **Large block body**: No limit, but warn user about response size

### Project Structure Notes

- **Components**: Extend existing Breakpoints folder
- **No shadcn/ui**: Raw Tailwind only
- **Component size**: RequestBlockerEditor ≤80 lines
- **Validation**: Client-side before save
- **Backend**: Rust handles actual request blocking (return response in handle_request)
- **Pattern**: Consistent with Story 10.5 ResponseMappingEditor and 10.6 StatusCodeEditor

### References

- Epic 10 full spec: [Source: _bmad-output/planning-artifacts/epic-10.md#Story-10.7]
- Story 10.6 (previous): [Source: _bmad-output/implementation-artifacts/10-6-extended-breakpoint-actions-status-header-editing.md]
- Story 10.5 (response mapping): [Source: _bmad-output/implementation-artifacts/10-5-extended-breakpoint-actions-response-mapping.md]
- Story 10.4 (breakpoint editor): [Source: _bmad-output/implementation-artifacts/10-4-breakpoint-editor-with-fuzzy-url-matching.md]
- Story 10.3 (breakpoints tab): [Source: _bmad-output/implementation-artifacts/10-3-breakpoints-tab-interface.md]
- Existing BreakpointsStore: [Source: fetch-boy/src/stores/breakpointsStore.ts]
- Existing BreakpointEditor: [Source: fetch-boy/src/components/Breakpoints/BreakpointEditor.tsx]
- Rust proxy: [Source: fetch-boy/src-tauri/src/proxy.rs]
- SQLite migrations: [Source: fetch-boy/src-tauri/migrations/]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

- `fetch-boy/src/lib/db.ts` (modified)
- `fetch-boy/src/lib/breakpoints.ts` (modified)
- `fetch-boy/src/stores/breakpointsStore.ts` (modified)
- `fetch-boy/src/components/Breakpoints/BreakpointEditor.tsx` (modified)
- `fetch-boy/src/components/Breakpoints/BreakpointRow.tsx` (modified)
- `fetch-boy/src/components/Breakpoints/RequestBlockerEditor.tsx` (new)
- `fetch-boy/src/components/Breakpoints/RequestBlockerEditor.test.tsx` (new)
- `fetch-boy/src-tauri/src/proxy.rs` (modified)
- `fetch-boy/src-tauri/src/db.rs` (modified)
- `fetch-boy/src-tauri/migrations/` (new migration file)

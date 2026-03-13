# Story 10.8: Play Button — Continue Interrupted Request

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an API developer using FetchBoy,
I want a play button UI that appears when a request matches a breakpoint,
so that I can continue, drop, or edit the request/response before it proceeds.

## Acceptance Criteria

1. When a request matches a breakpoint that requires user action:
   - Play button appears in the sidebar (next to breakpoint)
   - Play button appears in the bottom detail section
2. Play button options:
   - "Continue" - proceed with original/modified request
   - "Drop" - cancel the request entirely
   - "Edit & Continue" - open editor to modify before proceeding
3. Request execution is paused at the breakpoint
4. User can view full request/response details while paused
5. After user action, request proceeds or is dropped
6. Timeout handling if user doesn't respond (configurable, default 30s)
7. UI follows existing button patterns
8. Backend support for request pausing/resuming implemented

## Tasks / Subtasks

- [ ] Task 1 — Extend InterceptStore for breakpoint pause state (AC: #1, #3)
  - [ ] Add `pausedRequest` field to store: `{ request: InterceptRequest, breakpoint: Breakpoint, pausedAt: Date }`
  - [ ] Add `pauseState` enum: 'idle' | 'paused' | 'waiting-for-action' | 'resuming'
  - [ ] Add actions: pauseAtBreakpoint, resumeRequest, dropRequest, editAndResume
  - [ ] Add timeout handling with configurable duration

- [ ] Task 2 — Add Play Button UI to sidebar and detail view (AC: #1, #2)
  - [ ] Create `BreakpointActionPanel.tsx` component for sidebar
  - [ ] Add Play button (▶) with dropdown: Continue, Drop, Edit & Continue
  - [ ] Integrate into Intercept detail section when request is paused
  - [ ] Show paused request indicator in Intercept table

- [ ] Task 3 — Implement "Edit & Continue" flow (AC: #2)
  - [ ] Reuse existing BreakpointEditor from Story 10.4-10.7
  - [ ] Pre-populate with current request/response data
  - [ ] Allow modifying: response mapping, status code, headers
  - [ ] After edit, apply changes and continue request

- [ ] Task 4 — Implement backend pause/resume (AC: #3, #5, #8)
  - [ ] Modify proxy handler to pause before forwarding when breakpoint matches
  - [ ] Add Tauri commands: pause_request, resume_request, drop_request
  - [ ] Implement request state persistence during pause
  - [ ] Handle timeout: auto-drop or auto-continue after 30s

- [ ] Task 5 — Add timeout configuration UI (AC: #6)
  - [ ] Add timeout setting in BreakpointEditor or Settings
  - [ ] Default: 30 seconds
  - [ ] Options: 10s, 30s, 60s, 120s, never
  - [ ] Visual countdown timer while paused

- [ ] Task 6 — Integration testing (AC: #2, #4, #5)
  - [ ] Test pause and continue flow
  - [ ] Test drop request flow
  - [ ] Test edit and continue flow
  - [ ] Test timeout auto-drop behavior

- [ ] Final Task — Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 10.8

## Dev Notes

### 🚨 CRITICAL: This Story Requires All Previous Stories (10.4-10.7)

**Story 10.8 builds on the complete breakpoint system from Stories 10.4-10.7:**
- Story 10.4: Breakpoint Editor with URL matching
- Story 10.5: Response Mapping
- Story 10.6: Status & Header Editing
- Story 10.7: Request Blocking

The pause functionality is the FINAL piece that makes breakpoints fully interactive. When a request matches a breakpoint, instead of immediately applying modifications and forwarding, the proxy should PAUSE and wait for user input.

### Architecture Overview

This story modifies/adds the following files:

| File | Action |
|------|--------|
| `fetch-boy/src/stores/interceptStore.ts` | MODIFIED — add pause state and actions |
| `fetch-boy/src/stores/breakpointsStore.ts` | MODIFIED — add pause/resume actions |
| `fetch-boy/src/components/Breakpoints/BreakpointActionPanel.tsx` | NEW — sidebar play button UI |
| `fetch-boy/src/components/Intercept view/InterceptView.tsx` | MODIFIED — show pause UI in detail |
| `fetch-boy/src/components/Intercept view/PausedRequestDetail.tsx` | NEW — paused request viewer |
| `fetch-boy/src/components/Breakpoints/RequestEditDialog.tsx` | NEW — Edit & Continue dialog |
| `fetch-boy/src/components/Breakpoints/TimeoutConfig.tsx` | NEW — timeout settings |
| `fetch-boy/src-tauri/src/proxy.rs` | MODIFIED — implement pause/resume |
| `fetch-boy/src-tauri/src/lib.rs` | MODIFIED — add pause Tauri commands |
| `fetch-boy/src-tauri/src/db.rs` | MODIFIED — add pause state table |

### Data Structures

```typescript
// Extended InterceptStore for pause state
interface InterceptStore {
  // ... existing state
  pauseState: 'idle' | 'paused' | 'waiting-for-action' | 'resuming'
  pausedRequest: {
    request: InterceptRequest
    breakpoint: Breakpoint
    pausedAt: Date
    timeoutAt: Date
  } | null
  breakpointTimeout: number // seconds, default 30
  
  // ... existing actions
  pauseAtBreakpoint: (request: InterceptRequest, breakpoint: Breakpoint) => void
  continueRequest: () => Promise<void>
  dropRequest: () => Promise<void>
  editAndResume: (modifications: BreakpointModifications) => Promise<void>
  setBreakpointTimeout: (seconds: number) => void
}

// Breakpoint modifications from Edit & Continue
interface BreakpointModifications {
  responseMapping?: ResponseMapping
  statusCode?: { code: number; enabled: boolean }
  headers?: Array<{ key: string; value: string; enabled: boolean }>
}

// Paused request in Intercept table
interface InterceptRequest {
  id: string
  timestamp: Date
  method: string
  url: string
  host: string
  path: string
  requestHeaders: Record<string, string>
  requestBody?: string
  responseStatusCode?: number
  responseHeaders?: Record<string, string>
  responseBody?: string
  isPaused: boolean // NEW
  isBlocked: boolean
}
```

### SQLite Schema Update

```sql
-- Migration: add_pause_state_table
CREATE TABLE IF NOT EXISTS paused_requests (
    id TEXT PRIMARY KEY,
    request_data TEXT NOT NULL, -- JSON
    breakpoint_id TEXT NOT NULL,
    paused_at TEXT NOT NULL,
    timeout_at TEXT NOT NULL,
    status TEXT DEFAULT 'paused' -- 'paused', 'resuming', 'dropped'
);
```

### Rust Pause/Resume Flow

```rust
// In proxy.rs — extend InterceptHandler

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PausedRequest {
    pub id: String,
    pub request: InterceptRequest,
    pub breakpoint: Breakpoint,
    pub paused_at: i64,
    pub timeout_at: i64,
}

pub enum BreakpointAction {
    Continue,
    Drop,
    Modify(BreakpointModifications),
}

// Tauri commands
#[tauri::command]
pub async fn pause_request(
    request_id: String,
    breakpoint_id: String,
    timeout_seconds: u64,
) -> Result<PausedRequest, String> {
    // Store paused request in memory or SQLite
    let paused = PausedRequest {
        id: request_id,
        request: get_request_data(&request_id).await?,
        breakpoint: get_breakpoint(&breakpoint_id).await?,
        paused_at: Utc::now().timestamp(),
        timeout_at: Utc::now().timestamp() + timeout_seconds as i64,
    };
    
    // Emit event to frontend to show pause UI
    emit("breakpoint-paused", &paused).await;
    
    // Don't forward request yet - wait for user action
    Ok(paused)
}

#[tauri::command]
pub async fn resume_request(
    request_id: String,
    action: BreakpointAction,
) -> Result<(), String> {
    match action {
        BreakpointAction::Continue => {
            // Apply breakpoint modifications and forward
            forward_with_modifications(&request_id).await
        }
        BreakpointAction::Drop => {
            // Don't forward, just clean up
            remove_paused_request(&request_id).await;
            Ok(())
        }
        BreakpointAction::Modify(mods) => {
            // Apply user modifications and forward
            forward_with_modifications(&request_id, mods).await
        }
    }
}

#[tauri::command]
pub async fn drop_request(request_id: String) -> Result<(), String> {
    remove_paused_request(&request_id).await;
    // Emit dropped event
    emit("request-dropped", &request_id).await;
    Ok(())
}
```

### BreakpointActionPanel Component

```tsx
// fetch-boy/src/components/Breakpoints/BreakpointActionPanel.tsx

import { Play, Square, Pencil, Clock } from 'lucide-react'
import { useInterceptStore } from '@/stores/interceptStore'

interface Props {
  breakpoint: Breakpoint
  pausedRequest?: PausedRequest
}

export function BreakpointActionPanel({ breakpoint, pausedRequest }: Props) {
  const { pauseState, continueRequest, dropRequest, editAndResume } = useInterceptStore()
  
  const isPausedForThis = pauseState !== 'idle' && pausedRequest?.breakpoint.id === breakpoint.id
  
  return (
    <div className="flex items-center gap-2 p-2 bg-app-sidebar border border-app-subtle rounded">
      {isPausedForThis ? (
        <>
          <div className="flex items-center gap-1 text-amber-400">
            <Clock size={14} />
            <span className="text-xs">Paused</span>
          </div>
          
          <div className="flex gap-1">
            <button
              onClick={() => continueRequest()}
              className="p-1.5 bg-green-600 hover:bg-green-500 rounded text-white"
              title="Continue"
            >
              <Play size={14} />
            </button>
            
            <button
              onClick={() => dropRequest()}
              className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white"
              title="Drop"
            >
              <Square size={14} />
            </button>
            
            <button
              onClick={() => editAndResume({})}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white"
              title="Edit & Continue"
            >
              <Pencil size={14} />
            </button>
          </div>
        </>
      ) : (
        <span className="text-xs text-app-muted">Breakpoint set</span>
      )}
    </div>
  )
}
```

### PausedRequestDetail Component

```tsx
// fetch-boy/src/components/Intercept view/PausedRequestDetail.tsx

import { useInterceptStore } from '@/stores/interceptStore'
import { BreakpointActionPanel } from '@/components/Breakpoints/BreakpointActionPanel'

export function PausedRequestDetail() {
  const { pausedRequest, pauseState, breakpointTimeout } = useInterceptStore()
  
  if (pauseState === 'idle' || !pausedRequest) {
    return null
  }
  
  const timeRemaining = Math.max(0, 
    (new Date(pausedRequest.timeoutAt).getTime() - Date.now()) / 1000
  )
  
  return (
    <div className="p-4 bg-amber-900/20 border border-amber-500/50 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-amber-400 font-medium flex items-center gap-2">
          <Clock size={18} />
          Request Paused at Breakpoint
        </h3>
        <span className="text-amber-300 text-sm">
          {timeRemaining.toFixed(0)}s remaining
        </span>
      </div>
      
      {/* Request details */}
      <div className="mb-4">
        <p className="text-app-inverse font-mono text-sm">
          {pausedRequest.request.method} {pausedRequest.request.url}
        </p>
        <p className="text-app-muted text-xs mt-1">
          Matched breakpoint: {pausedRequest.breakpoint.name}
        </p>
      </div>
      
      {/* Action panel */}
      <BreakpointActionPanel 
        breakpoint={pausedRequest.breakpoint} 
        pausedRequest={pausedRequest}
      />
      
      {/* Quick view of breakpoint actions enabled */}
      <div className="mt-4 flex gap-2">
        {pausedRequest.breakpoint.responseMapping?.enabled && (
          <Badge variant="outline">Response Mapping</Badge>
        )}
        {pausedRequest.breakpoint.statusCode?.enabled && (
          <Badge variant="outline">Status: {pausedRequest.breakpoint.statusCode.code}</Badge>
        )}
        {pausedRequest.breakpoint.headers?.some(h => h.enabled) && (
          <Badge variant="outline">+{pausedRequest.breakpoint.headers.filter(h => h.enabled).length} Headers</Badge>
        )}
        {pausedRequest.breakpoint.blockRequest?.enabled && (
          <Badge variant="destructive">Blocking</Badge>
        )}
      </div>
    </div>
  )
}
```

### Timeout Configuration

```tsx
// fetch-boy/src/components/Breakpoints/TimeoutConfig.tsx

interface Props {
  timeout: number // seconds
  onChange: (seconds: number) => void
}

const TIMEOUT_OPTIONS = [
  { value: 10, label: '10 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 0, label: 'Never' },
]

export function TimeoutConfig({ timeout, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Clock size={14} className="text-app-muted" />
      <select
        value={timeout}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1 text-sm"
      >
        {TIMEOUT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
```

### Dependencies with Previous Stories

- **Story 10.7**: Request Blocking (CRITICAL - this story adds pause BEFORE the blocking happens)
  - BreakpointEditor already supports all modifications (response mapping, status, headers, blocking)
  - Breakpoint type has all fields needed
  - Store has all CRUD operations
  - Rust proxy has modification logic
- **Story 10.6**: Status & Header Editing
- **Story 10.5**: Response Mapping
- **Story 10.4**: Breakpoint Editor with URL matching
- **Story 10.3**: Breakpoints tab interface
- **Story 10.2**: Request detail view
- **Story 10.1**: Split view with request table
- **Story 9.3**: MITM proxy backend

### Testing Approach

```tsx
// fetch-boy/src/components/Breakpoints/BreakpointActionPanel.test.tsx

describe('BreakpointActionPanel', () => {
  it('shows paused state when request is paused', () => {
    render(<BreakpointActionPanel 
      breakpoint={bp} 
      pausedRequest={{ ...pausedReq, breakpoint: bp }}
    />)
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('calls continueRequest when play button clicked', () => {
    const continueMock = jest.fn()
    render(<BreakpointActionPanel breakpoint={bp} pausedRequest={paused} />)
    fireEvent.click(screen.getByTitle('Continue'))
    expect(continueMock).toHaveBeenCalled()
  })

  it('calls dropRequest when stop button clicked', () => {
    const dropMock = jest.fn()
    render(<BreakpointActionPanel breakpoint={bp} pausedRequest={paused} />)
    fireEvent.click(screen.getByTitle('Drop'))
    expect(dropMock).toHaveBeenCalled()
  })
})

// fetch-boy/src/components/Intercept view/PausedRequestDetail.test.tsx

describe('PausedRequestDetail', () => {
  it('shows countdown timer', () => {
    render(<PausedRequestDetail />)
    expect(screen.getByText(/remaining/)).toBeInTheDocument()
  })

  it('shows breakpoint action badges', () => {
    const pausedWithMapping = {
      ...pausedReq,
      breakpoint: { ...bp, responseMapping: { enabled: true, body: '{}', contentType: 'application/json' }}
    }
    render(<PausedRequestDetail />)
    expect(screen.getByText('Response Mapping')).toBeInTheDocument()
  })
})
```

### Edge Cases

1. **User doesn't respond**: Auto-drop after timeout (configurable)
2. **Multiple breakpoints match**: Pause at first matching breakpoint, then continue
3. **App closed while paused**: Persist pause state, resume on reopen (optional v2)
4. **Network error during resume**: Show error, keep request paused
5. **Edit & Continue with invalid data**: Validate before proceeding
6. **Breakpoint deleted while paused**: Handle gracefully, drop request
7. **Very large request/response**: Lazy load body in paused detail view

### Project Structure Notes

- **Components**: Extend existing Breakpoints and Intercept view folders
- **No shadcn/ui**: Raw Tailwind only
- **Component size**: BreakpointActionPanel ≤60 lines, PausedRequestDetail ≤100 lines
- **State**: InterceptStore handles all pause logic
- **Backend**: Rust proxy manages actual request pause/resume
- **Pattern**: Consistent with existing Intercept and Breakpoints UI

### References

- Epic 10 full spec: [Source: _bmad-output/planning-artifacts/epic-10.md#Story-10.8]
- Story 10.7 (previous): [Source: _bmad-output/implementation-artifacts/10-7-extended-breakpoint-actions-request-blocking.md]
- Story 10.6: [Source: _bmad-output/implementation-artifacts/10-6-extended-breakpoint-actions-status-header-editing.md]
- Story 10.5: [Source: _bmad-output/implementation-artifacts/10-5-extended-breakpoint-actions-response-mapping.md]
- Story 10.4: [Source: _bmad-output/implementation-artifacts/10-4-breakpoint-editor-with-fuzzy-url-matching.md]
- Story 10.3: [Source: _bmad-output/implementation-artifacts/10-3-breakpoints-tab-interface.md]
- Story 10.2: [Source: _bmad-output/implementation-artifacts/10-2-request-detail-view-with-subtabs.md]
- Story 10.1: [Source: _bmad-output/implementation-artifacts/10-1-intercept-split-view-with-request-table.md]
- Story 9.3 (MITM proxy): [Source: _bmad-output/implementation-artifacts/9-3-mitm-proxy-backend.md]
- Existing InterceptStore: [Source: fetch-boy/src/stores/interceptStore.ts]
- Existing BreakpointsStore: [Source: fetch-boy/src/stores/breakpointsStore.ts]
- Existing BreakpointEditor: [Source: fetch-boy/src/components/Breakpoints/BreakpointEditor.tsx]
- Rust proxy: [Source: fetch-boy/src-tauri/src/proxy.rs]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List


# Story 6.4: Request Timeout Configuration

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to configure a timeout for individual requests,
so that runaway or unresponsive calls fail fast with a clear message rather than hanging indefinitely.

## Acceptance Criteria

1. A **Timeout** field appears in the request builder toolbar (adjacent to the Send/Cancel button), accepting an integer value in milliseconds (default: `30000`)
2. The timeout value is stored per-tab in `tabStore` alongside the rest of the request state
3. A global default timeout is configurable in the Settings panel (Story 4.3); all new tabs inherit this default
4. When a request exceeds the configured timeout, it is automatically cancelled and the response pane shows **"Timed out after Xs"** (neutral messaging, not an error)
5. Timeout of `0` means no timeout (request runs until it completes or is manually cancelled)
6. The timeout field accepts only positive integers; invalid input reverts to the previous valid value
7. Timeout behaviour is implemented on the Rust/Tauri side (not relying solely on browser fetch timeout)
8. Per-tab timeout value persists for the lifetime of the session (resets to global default on new tab)

## Tasks / Subtasks

- [x] Task 1 - Add timeout field to tab state (AC: 2, 8)
  - [x] Add `timeout: number` field to `Tab` type in `tabStore.ts`
  - [x] Initialize timeout with global default value when creating new tabs
  - [x] Ensure timeout persists in tab state for session lifetime

- [x] Task 2 - Create TimeoutInput component (AC: 1)
  - [x] Create `TimeoutInput.tsx` component in `src/components/RequestBuilder/`
  - [x] Add input field with "ms" suffix label
  - [x] Position in Options tab of Request Details accordion (user preference)
  - [x] Validate input: only positive integers allowed
  - [x] On invalid input, revert to previous valid value
  - [x] Style consistently with other toolbar inputs

- [x] Task 3 - Integrate timeout with Rust backend (AC: 7)
  - [x] Modify Tauri command to accept timeout parameter (already existed; now uses per-tab value)
  - [x] Timeout logic in Rust via reqwest Client::builder().timeout() (already existed)
  - [x] Return `__TIMEOUT__` sentinel from Rust on timeout (distinct from network errors)
  - [x] Frontend receives clear timeout signal

- [x] Task 4 - Handle timeout response display (AC: 4)
  - [x] Detect `__TIMEOUT__` signal from Rust backend in MainPanel
  - [x] Display "Timed out after Xs" message in response pane (neutral styling, not red)
  - [x] Timeout is distinguishable from network errors and cancellation

- [x] Task 5 - Global default timeout in Settings (AC: 3)
  - [x] Timeout setting already exists in Settings panel (Story 4.3 integration)
  - [x] Global default stored in uiSettingsStore
  - [x] New tabs inherit global default via `useUiSettingsStore.getState().requestTimeoutMs`

- [x] Task 6 - Handle timeout=0 edge case (AC: 5)
  - [x] When timeout_ms == 0, client.timeout() is NOT called (no timeout on reqwest client)
  - [x] JS-side invokeWithTimeout guard also skipped when timeout === 0

- [x] Task 7 - Write tests (AC: all)
  - [x] 12 unit tests for TimeoutInput component
  - [x] Test invalid input rejection (non-numeric, decimals, negative)
  - [x] Test zero timeout, blur revert, tab sync, disabled state
  - [x] 4 new tests in ResponseViewer for wasTimedOut neutral display

- [x] Task 8 - Verify and commit story changes
  - [x] Run `npx tsc --noEmit` from `` — no errors
  - [x] Run `npx vitest run` from `` — 441 tests pass
  - [x] Commit: 4bc5c34 "Story 6.4: Implement request timeout configuration"

## Dev Notes

### Critical Implementation Details

**Timeout Field UI:**

Following the established UI patterns in the request builder toolbar:

```typescript
// TimeoutInput.tsx component structure
interface TimeoutInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function TimeoutInput({ value, onChange, disabled }: TimeoutInputProps) {
  const [inputValue, setInputValue] = useState(value.toString());
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Validate: only positive integers
    if (!/^\d*$/.test(newValue)) return;
    setInputValue(newValue);
  };
  
  const handleBlur = () => {
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < 0) {
      setInputValue(value.toString()); // Revert to previous
      return;
    }
    onChange(num);
  };
  
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        className="w-20 h-8 px-2 text-sm border rounded"
        placeholder="30000"
      />
      <span className="text-xs text-muted">ms</span>
    </div>
  );
}
```

**Tab Store Extension:**

```typescript
// In tabStore.ts - add to Tab interface
interface Tab {
  // ... existing fields
  timeout: number; // milliseconds, default 30000
}

// In createNewTab function:
const createNewTab = (): Tab => ({
  id: generateId(),
  // ... other defaults
  timeout: getGlobalDefaultTimeout(), // Story 6.4: new field
});
```

**Rust Timeout Implementation:**

```rust
// In Tauri command for HTTP requests
#[tauri::command]
async fn send_request(url: String, method: String, timeout_ms: u64) -> Result<Response, String> {
    if timeout_ms == 0 {
        // No timeout - use standard request
        return send_request_internal(url, method, None).await;
    }
    
    let duration = Duration::from_millis(timeout_ms);
    match timeout(duration, send_request_internal(url, method, None)).await {
        Ok(result) => result,
        Err(_) => Err("timeout".to_string()), // Distinct timeout error
    }
}
```

**Response Handling:**

```typescript
// In MainPanel or response handler
const handleResponse = (response: Response | string) => {
  if (response === "timeout") {
    const timeoutSec = (tab.timeout / 1000).toFixed(1);
    setResponse({
      status: 0,
      statusText: "Timed out",
      body: `Timed out after ${timeoutSec}s`,
      isTimeout: true, // Special flag for neutral styling
    });
    return;
  }
  // Normal response handling...
};
```

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Zustand with immer middleware (tabStore uses immer)
- Tailwind CSS utility classes with `app-*` custom tokens
- Vitest + React Testing Library for tests
- Tauri/Rust backend for HTTP requests
- lucide-react for icons

**Component/File Conventions:**
- Input components in `src/components/RequestBuilder/`
- Tests co-located: `ComponentName.test.tsx` alongside source
- Use consistent styling with other toolbar inputs (Send button, method selector)

**State Management Rules:**
- Timeout stored per-tab in tabStore
- Global default stored in app settings (separate from tabStore)
- Use immer for immutable updates to tab state

### Integration Points

- **MainPanel**: Add TimeoutInput component in toolbar area, pass timeout to send function
- **tabStore**: Add `timeout` field to Tab type, initialize with global default
- **Settings**: Add global default timeout setting (Story 4.3 integration)
- **Rust backend**: Modify send_request command to accept and handle timeout parameter
- **Response handling**: Detect timeout response, display neutral "Timed out" message

### Critical Implementation Guardrails

1. **Timeout must be Rust-side**: Don't rely solely on browser fetch timeout. The AC explicitly states "implemented on the Rust/Tauri side".

2. **Neutral timeout messaging**: Timeout is NOT an error - display neutral "Timed out after Xs" message, not red error styling.

3. **Input validation**: Only positive integers. Revert to previous valid value on blur with invalid input.

4. **Zero timeout means no timeout**: AC states "timeout of 0 means no timeout" - pass this to Rust to disable timeout logic.

5. **Per-tab persistence**: Each tab has its own timeout value that persists for session lifetime.

6. **Global default inheritance**: New tabs inherit global default from Settings, not hardcoded value.

### Previous Story Intelligence

**From Story 6.3 (Keyboard Shortcut to Send Request):**
- Story 6.3 adds `Cmd/Ctrl + Enter` keyboard shortcut for sending requests
- This is parallel work - Story 6.4 timeout should work with the shortcut as well
- The keyboard shortcut doesn't need modification for timeout - it just triggers send

**From Story 6.2 (Request Cancellation):**
- Story 6.2 introduced `AbortController` for request cancellation
- Story 6.4 timeout should work alongside cancellation - timeout triggers automatic cancellation
- The timeout error should be distinguishable from manual cancellation ("Request cancelled" vs "Timed out")

**From Story 4.3 (Settings Panel):**
- Settings panel exists and stores global preferences
- Story 6.4 should integrate timeout default with existing Settings
- Check existing Settings structure for where to add timeout default

### Git History Analysis

Recent commits show:
- Story 6.1 completed: Foldable sidebar with Cmd/Ctrl+B
- Story 6.2: Request cancellation in progress
- Stories 5.x all in review status (Tab bar, keyboard shortcuts, etc.)

The timeout feature builds on the request cancellation infrastructure from Story 6.2.

### Testing Requirements

**Unit Tests (TimeoutInput.test.tsx):**

```typescript
// Test: Valid numeric input
render(<TimeoutInput value={30000} onChange={fn} />);
fireEvent.change(screen.getByRole('textbox'), { target: { value: '5000' } });
fireEvent.blur(screen.getByRole('textbox'));
expect(onChange).toHaveBeenCalledWith(5000);

// Test: Invalid input - letters
render(<TimeoutInput value={30000} onChange={fn} />);
fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
expect(screen.getByRole('textbox').value).toBe('30000'); // Reverted

// Test: Invalid input - negative
fireEvent.change(screen.getByRole('textbox'), { target: { value: '-1000' } });
expect(screen.getByRole('textbox').value).toBe('30000'); // Reverted

// Test: Zero timeout (no timeout)
fireEvent.change(screen.getByRole('textbox'), { target: { value: '0' } });
fireEvent.blur(screen.getByRole('textbox'));
expect(onChange).toHaveBeenCalledWith(0);
```

**Integration Tests:**

```typescript
// Test: Timeout triggers Rust cancellation
// Test: Response shows "Timed out after Xs" message
// Test: New tab inherits global default timeout
```

### Project Structure Notes

**New Files:**
- `src/components/RequestBuilder/TimeoutInput.tsx` - New timeout input component

**Modified Files:**
- `src/stores/tabStore.ts` - Add timeout field to Tab type
- `src/components/MainPanel/MainPanel.tsx` - Add TimeoutInput to toolbar
- `src/components/RequestBuilder/TimeoutInput.test.tsx` - New test file
- `src-tauri/src/main.rs` - Add timeout parameter to HTTP command
- Settings panel (if needed): Add global default timeout setting

### References

- **Primary Source**: `_bmad-output/planning-artifacts/epic-6.md` (Story 6.4 acceptance criteria)
- **tabStore**: `src/stores/tabStore.ts` (Tab type definition)
- **MainPanel**: `src/components/MainPanel/MainPanel.tsx` (toolbar structure)
- **Settings**: Story 4.3 settings panel for global default integration
- **Story 6.2**: Request cancellation for AbortController pattern
- **Story 6.3**: Keyboard shortcut - parallel work, no integration needed

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Workflow: create-story (Story 6.4)
- Epic: 6 - Workspace Ergonomics & Developer Flow
- Previous Stories: 6-1-foldable-side-panel, 6-2-request-cancellation, 6-3-keyboard-shortcut-to-send-request
- Auto-generated context engine analysis completed

### Completion Notes List

- Task 5 was already complete (uiSettingsStore + SettingsPanel already had requestTimeoutMs)
- Task 3 Rust side was partially done (timeout_ms accepted); added __TIMEOUT__ sentinel detection and timeout=0 fix
- TimeoutInput placed in new "Options" tab of Request Details accordion (user preference, not toolbar)
- Added `options` to RequestTab union and REQUEST_TABS array
- wasTimedOut + timedOutAfterSec fields added to ResponseSnapshot for neutral display
- 441 tests pass; TypeScript compiles cleanly
- Commit: 4bc5c34

### File List

- `src/stores/tabStore.ts` — added `timeout` to RequestSnapshot, `wasTimedOut`/`timedOutAfterSec` to ResponseSnapshot
- `src/stores/requestStore.ts` — added `'options'` to RequestTab union
- `src/components/RequestBuilder/TimeoutInput.tsx` — new component
- `src/components/RequestBuilder/TimeoutInput.test.tsx` — 12 unit tests
- `src/components/MainPanel/MainPanel.tsx` — Options tab + TimeoutInput, __TIMEOUT__ handling, per-tab timeout
- `src/components/ResponseViewer/ResponseViewer.tsx` — wasTimedOut neutral display
- `src/components/ResponseViewer/ResponseViewer.test.tsx` — 4 new timeout tests
- `src-tauri/src/http.rs` — timeout=0 no-op, __TIMEOUT__ sentinel on reqwest timeout

## Change Log

- 2026-03-11: Story 6.4 context created via automated create-story workflow — comprehensive developer guide with timeout input UI, Rust backend integration, per-tab state management, and global default settings integration
- 2026-03-11: Story 6.4 implemented by dev agent — all 8 tasks complete, 441 tests passing, committed as 4bc5c34

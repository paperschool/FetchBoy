# Story 6.2: Request Cancellation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to cancel an in-flight HTTP request,
so that I don't have to wait for a slow or unresponsive endpoint to time out when I change my mind.

## Acceptance Criteria

1. While a request is in-flight, the **Send** button label changes to **Cancel** and displays a loading spinner or progress indicator
2. Clicking **Cancel** immediately aborts the HTTP request via `AbortController` on the frontend and a Tauri command cancellation signal on the Rust side
3. The response pane transitions to a clear **"Request cancelled"** state (distinct from an error response — no red status, neutral messaging)
4. Cancellation completes instantly — the UI does not freeze or wait for the network call to time out
5. After cancellation, the Send button reverts to its normal state and the user can immediately send a new request
6. Cancellation is scoped to the active tab — other tabs' in-flight requests are unaffected
7. If the request completes before the cancel is processed, the response is shown normally (no race-condition blank state)

## Tasks / Subtasks

- [ ] Task 1 - Add `wasCancelled` state to `ResponseSnapshot` in `tabStore` (AC: 3, 5, 7)
  - [ ] Add `wasCancelled: boolean` field to `ResponseSnapshot` interface in `fetch-boy/src/stores/tabStore.ts`
  - [ ] Initialize `wasCancelled: false` in `createDefaultResponseSnapshot()`
  - [ ] `wasCancelled` is reset to `false` at the start of each new send (`updateRes({ isSending: true, wasCancelled: false, ... })`)

- [ ] Task 2 - Implement Rust-side cancellation registry (AC: 2, 4)
  - [ ] Add `tokio = { version = "1", features = ["sync"] }` to `fetch-boy/src-tauri/Cargo.toml` dependencies
  - [ ] Create `CancellationRegistry` struct in `fetch-boy/src-tauri/src/http.rs`:
    ```rust
    use std::collections::HashMap;
    use std::sync::Mutex;
    use tokio::sync::oneshot;
    pub struct CancellationRegistry(pub Mutex<HashMap<String, oneshot::Sender<()>>>);
    ```
  - [ ] Add `request_id: Option<String>` field to `SendRequestPayload` struct
  - [ ] Modify `send_request` command signature to accept `tauri::State<'_, CancellationRegistry>` and `request_id`
  - [ ] In `send_request`: if `request_id` is `Some`, create oneshot channel `(tx, rx)`, store `tx` in registry under `request_id`, then use `tokio::select!` to race `request_builder.send().await` vs `rx` receiver; on cancellation branch return `Err("__CANCELLED__".to_string())`
  - [ ] Clean up registry entry after request completes or cancels
  - [ ] Add new `cancel_request` command in `fetch-boy/src-tauri/src/http.rs`:
    ```rust
    #[tauri::command]
    pub async fn cancel_request(
        request_id: String,
        state: tauri::State<'_, CancellationRegistry>,
    ) -> Result<(), String> {
        let mut map = state.0.lock().map_err(|e| e.to_string())?;
        if let Some(sender) = map.remove(&request_id) {
            let _ = sender.send(());
        }
        Ok(())
    }
    ```
  - [ ] Register `CancellationRegistry` state and `cancel_request` command in `fetch-boy/src-tauri/src/lib.rs`:
    - Add `.manage(http::CancellationRegistry(std::sync::Mutex::new(std::collections::HashMap::new())))`
    - Add `http::cancel_request` to `tauri::generate_handler![]`

- [ ] Task 3 - Update frontend request/cancel flow in `MainPanel.tsx` (AC: 1, 2, 4, 5, 6, 7)
  - [ ] Add `import { useRef } from 'react'` (already has `useEffect, useState` — add `useRef`)
  - [ ] Add `import { Loader2, X } from 'lucide-react'` for cancel button icons
  - [ ] Add abort controller ref: `const abortControllerRef = useRef<AbortController | null>(null)` inside `MainPanel`
  - [ ] Get `activeTabId` from tabStore: `const activeTabId = useTabStore((s) => s.activeTabId)`
  - [ ] Modify `handleSendRequest()`:
    - Create new `AbortController` at start: `const controller = new AbortController(); abortControllerRef.current = controller;`
    - Pass `requestId: activeTabId` in the invoke payload
    - Set `wasCancelled: false` in the initial state update: `updateRes({ isSending: true, requestError: null, responseData: null, wasCancelled: false, sentUrl: requestedUrlForDisplay })`
    - Build an `abortPromise` that races against the abort signal:
      ```typescript
      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new DOMException('AbortError', 'AbortError'));
        });
      });
      ```
    - Replace `invokeWithTimeout(invoke<ResponseData>(...), ...)` with `Promise.race([invokeWithTimeout(invoke<ResponseData>(...), ...), abortPromise])`
    - In the `catch` block, check for cancellation BEFORE the general error handler:
      ```typescript
      if (error instanceof DOMException && error.name === 'AbortError') {
        updateRes({ isSending: false, wasCancelled: true, responseData: null, requestError: null });
        appendLog('Request cancelled by user.');
        return; // Do NOT persist to history
      }
      ```
    - Also check for the Rust-side `__CANCELLED__` signal: if `reason` includes `__CANCELLED__`, treat same as AbortError
    - Clear abort controller ref in `finally`: `abortControllerRef.current = null`
  - [ ] Add `handleCancelRequest()` function:
    ```typescript
    const handleCancelRequest = () => {
      abortControllerRef.current?.abort(); // immediately rejects the race
      invoke('cancel_request', { requestId: activeTabId }).catch(() => {}); // fire-and-forget to Rust
      appendLog('Cancel requested by user.');
    };
    ```
  - [ ] Update Send/Cancel button JSX — replace single button with conditional:
    ```tsx
    {isSending ? (
      <button
        type="button"
        onClick={handleCancelRequest}
        className="flex items-center gap-1.5 h-9 rounded-md border border-amber-500 bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600 hover:border-amber-600 cursor-pointer transition-colors"
        aria-label="Cancel request"
      >
        <Loader2 size={14} className="animate-spin" />
        Cancel
      </button>
    ) : (
      <button
        type="button"
        onClick={handleSendRequest}
        className="flex items-center gap-1.5 h-9 rounded-md border border-green-600 bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 hover:border-green-700 cursor-pointer transition-colors"
      >
        <Send size={14} />
        Send
      </button>
    )}
    ```
  - [ ] Update ResponseViewer rendering condition in MainPanel to include `wasCancelled`:
    ```tsx
    {responseData || requestError || verboseLogs.length > 0 || wasCancelled ? (
      <ResponseViewer
        response={responseData}
        error={requestError}
        logs={verboseLogs}
        wasCancelled={wasCancelled}
        onClearLogs={() => updateRes({ verboseLogs: [] })}
        requestedUrl={sentUrl ?? undefined}
      />
    ) : (
      <p className="text-app-muted text-sm">Send a request to see response details.</p>
    )}
    ```
  - [ ] Destructure `wasCancelled` from response state alongside other response state values

- [ ] Task 4 - Update `ResponseViewer` to render cancellation state (AC: 3)
  - [ ] Add `wasCancelled?: boolean` to `ResponseViewerProps` interface in `fetch-boy/src/components/ResponseViewer/ResponseViewer.tsx`
  - [ ] In `ResponseViewer` function body, add early-return or conditional for cancelled state:
    - When `wasCancelled` is `true` AND `response` is `null` AND `error` is `null`, show neutral cancellation message:
      ```tsx
      {wasCancelled && !response && !error && (
        <div className="flex items-center gap-2 text-app-secondary text-sm py-2">
          <X size={14} className="text-app-muted" />
          <span>Request cancelled</span>
        </div>
      )}
      ```
    - This renders above or instead of the empty state — ensure it uses `text-app-secondary` (neutral, not red)
    - The normal error display path (`error` string) must NOT show for cancellations since we never set `requestError` on cancel

- [ ] Task 5 - Write tests (AC: all)
  - [ ] Update `fetch-boy/src/stores/tabStore.test.ts`:
    - Verify `wasCancelled` initializes to `false` in `createDefaultResponseSnapshot()`
    - Verify `updateTabResponseState` correctly patches `wasCancelled`
  - [ ] Update `fetch-boy/src/components/MainPanel/MainPanel.test.tsx`:
    - Verify Send button renders initially (not Cancel)
    - Mock `isSending = true` via `useTabStore.setState` and verify Cancel button renders with "Cancel" label
    - Verify clicking Cancel calls `invoke('cancel_request', ...)` (mock invoke)
    - Verify Send button re-appears after cancellation (`isSending = false`, `wasCancelled = true`)
    - Verify "Request cancelled" text appears in response panel when `wasCancelled = true`
    - Verify cancellation does NOT call `persistHistoryEntry` (executeMock should not be called)
    - Verify race condition: if request completes before cancel (mock resolves first), response is shown normally
  - [ ] Update `fetch-boy/src/components/ResponseViewer/ResponseViewer.test.tsx`:
    - Verify `wasCancelled={true}` renders neutral "Request cancelled" text (not error styling)
    - Verify `wasCancelled={false}` with no response shows nothing cancellation-related
    - Verify normal error display is unaffected

- [ ] Task 6 - Verify and commit story changes
  - [ ] Run `npx tsc --noEmit` from `fetch-boy/` to verify TypeScript compilation
  - [ ] Run `npx vitest run` from `fetch-boy/` to verify all tests pass
  - [ ] Verify Rust builds: `cargo build` from `fetch-boy/src-tauri/`
  - [ ] Manual test: Send a slow request (e.g., to `https://httpbin.org/delay/10`), click Cancel, verify instant "Request cancelled" state
  - [ ] Manual test: Send a fast request, verify it completes normally (no race-condition blank state)
  - [ ] Manual test: Open two tabs, start a slow request in Tab 1, verify Tab 2's Send button is unaffected
  - [ ] Manual test: Cancel in Tab 1, verify Tab 2's request is unaffected
  - [ ] Commit all code and documentation changes with a message including `Story 6.2`

## Dev Notes

### Critical Architecture — How Cancellation Works End-to-End

**Frontend Race Pattern (AbortController):**

```
handleSendRequest():
  1. Create AbortController → store in abortControllerRef.current
  2. Build abortPromise (rejects on signal.abort())
  3. Promise.race([invokeWithTimeout(invoke('send_request', {..., requestId})), abortPromise])
  4. catch AbortError → set wasCancelled=true, isSending=false, skip history
  5. finally → abortControllerRef.current = null

handleCancelRequest():
  1. abortControllerRef.current.abort() → immediately rejects the race
  2. invoke('cancel_request', { requestId }) → fire-and-forget (Rust kills reqwest)
```

**Why the race pattern works without freezing:**
- `AbortController.abort()` synchronously dispatches the abort event
- The `abortPromise` rejection fires in the same microtask tick
- `Promise.race` resolves with the first settled promise
- The catch block runs before Rust returns — UI transitions instantly

**Rust Cancellation Registry:**

```
send_request(payload, state: CancellationRegistry):
  if request_id is Some:
    let (tx, rx) = oneshot::channel()
    registry.lock().insert(request_id, tx)
    tokio::select! {
      result = request_builder.send() => { cleanup registry; return result }
      _ = rx => { cleanup registry; return Err("__CANCELLED__") }
    }
  else:
    // no cancellation support - existing timeout behavior

cancel_request(request_id, state):
  if let Some(tx) = registry.lock().remove(request_id):
    tx.send(())  // signals tokio::select! to cancel
```

**Race condition safety (AC 7):**
- If request completes before cancel: `tokio::select!` completes on the `result` branch, registry entry is cleaned up; `cancel_request` command finds no entry and is a no-op
- On frontend: `Promise.race` settles with the successful response; abort fires but the promise is already settled and ignored

### Existing Integration Points

- **Send button**: `fetch-boy/src/components/MainPanel/MainPanel.tsx:507-515` — currently disabled when `isSending`, wraps `handleSendRequest`
- **`isSending` state**: `fetch-boy/src/stores/tabStore.ts:22` in `ResponseSnapshot` — already used to disable send and show "Sending..." text
- **`invokeWithTimeout` wrapper**: `fetch-boy/src/components/MainPanel/MainPanel.tsx:328-344` — wraps invoke with timeout; must be preserved and extended with abort race
- **Tauri invoke**: `fetch-boy/src/components/MainPanel/MainPanel.tsx:392-406` — calls `send_request` command; needs `requestId` added to payload
- **ResponseViewer**: `fetch-boy/src/components/ResponseViewer/ResponseViewer.tsx:41` — renders response/error/logs; needs `wasCancelled` prop
- **`activeTabId`**: available via `useTabStore((s) => s.activeTabId)` — use this as the `requestId` for tab-scoped cancellation

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Zustand with immer middleware (tabStore uses immer)
- Tailwind CSS utility classes with `app-*` custom tokens
- Vitest + React Testing Library for tests
- Rust/Tauri v2 with reqwest 0.12 for HTTP
- tokio (already used transitively via tauri) — add explicit dependency for `oneshot` channels

**Component/File Conventions:**
- MainPanel is a function component, no class components
- Hooks follow `use[Name].ts` pattern in `src/hooks/`
- Tests co-located: `ComponentName.test.tsx` alongside `ComponentName.tsx`
- Zustand store patches via `updateTabResponseState(id, patch)` — never mutate store directly in components
- Use `useActiveResponseState()` hook from `src/hooks/useActiveTabState.ts` for reactive response state

**State Management Rules:**
- `AbortController` is NOT stored in Zustand (not serializable, not reactive-needed) — use `useRef` in MainPanel
- `wasCancelled: boolean` IS stored in `ResponseSnapshot` (drives UI rendering reactively)
- `isSending` reset to `false` in both success and cancel paths (already in `finally` for success — cancel must also set it)

**Styling Rules:**
- Cancel button: use `amber-500` border/bg (neutral warning, not destructive red)
- "Request cancelled" message: use `text-app-secondary` (neutral, NOT `text-red-*`)
- Spinner: `Loader2` from `lucide-react` with `animate-spin` class
- Cancel icon: `X` from `lucide-react`

**Tauri v2 State Management:**
- App state registered via `.manage()` in `lib.rs` Builder chain
- State accessed via `tauri::State<'_, T>` in command signatures
- `Mutex` (std, not tokio) for the HashMap — prevent concurrent write races
- Clean up HashMap entries after use to prevent memory leaks

### Critical Implementation Guardrails

1. **AbortController scope**: Create a NEW AbortController per send invocation. Never reuse across requests. Clear `abortControllerRef.current = null` in `finally`.

2. **No history entry on cancel**: The `persistHistoryEntry` call must be skipped entirely when cancellation occurs. Check for `AbortError` BEFORE the general error handler.

3. **`isSending` must reset to `false` on cancel**: The cancel flow must set `isSending: false`. Currently `finally { updateRes({ isSending: false }) }` handles this, but ensure the AbortError catch returns BEFORE `finally` could cause double-update issues. The `finally` block WILL still run after the early return in catch — this is correct behavior.

4. **Don't set `requestError` on cancel**: The `requestError` field is for actual failures. Setting it on cancel would show an error state. Use `wasCancelled` exclusively.

5. **Rust registry cleanup**: Always remove from `CancellationRegistry` in both the success and cancel branches of `tokio::select!` to prevent HashMap growth.

6. **`__CANCELLED__` string guard**: On the frontend, if the Rust side returns `Err("__CANCELLED__")` (e.g., if the abort signal fires slightly after Rust processes the cancel), treat it the same as `AbortError`. Check: `if (reason === '__CANCELLED__') { /* treat as cancel */ }`.

7. **`requestId` in payload**: The `SendRequestPayload` struct needs `request_id: Option<String>`. Mark it `#[serde(rename_all = "camelCase")]` OR explicitly rename to match frontend's camelCase `requestId`. Current convention in `http.rs` uses `camelCase` field names from frontend (see `queryParams`).

8. **Tab isolation**: `activeTabId` is used as `requestId`. Since tabs have UUIDs, there's no collision risk. If Tab A is cancelled, `cancel_request(tabAId)` only removes Tab A's sender.

9. **Do NOT disable the Cancel button**: Unlike the current Send button (disabled when isSending), the Cancel button should NEVER be disabled — it must always be clickable while visible.

### Previous Story Intelligence (Story 6.1)

From **Story 6.1 (Foldable Side Panel)**:

1. **Pattern: `useRef` for non-reactive values**: Story 6.1 established `useRef` usage pattern in hooks. The `abortControllerRef` follows the same `useRef<T | null>(null)` pattern.

2. **`uiSettingsStore` has `requestTimeoutMs` and `sslVerify`**: These are already destructured in MainPanel via `useUiSettingsStore`. The `requestTimeoutMs` is used in `invokeWithTimeout` — keep using it.

3. **State management pattern**: Story 6.1 used `updateTabResponseState` (via `updateRes` helper) for reactive state updates. Follow same pattern for `wasCancelled`.

4. **Keyboard shortcut hook pattern**: From `useTabKeyboardShortcuts.ts` — cancellation does NOT need a keyboard shortcut (Story 6.3 is the keyboard shortcut story). Don't over-engineer here.

5. **lucide-react icons**: `Loader2` (spinner) and `X` (cancel icon) are available in `lucide-react`. Import pattern: `import { Send, Save, Loader2, X } from 'lucide-react'`.

**From Earlier Stories (5.4 keyboard shortcuts, 4.3 settings):**

- `invokeWithTimeout` was added in a previous story for timeout support. Keep it and compose with `Promise.race` rather than replacing it.
- The `requestTimeoutMs` default is `30000` (30s). The `invokeWithTimeout` adds 5s buffer: `requestTimeoutMs + 5000`. Keep this buffer logic.

### Testing Requirements

**Unit Tests (tabStore.test.ts):**
- `createDefaultResponseSnapshot()` should have `wasCancelled: false`
- `updateTabResponseState` with `{ wasCancelled: true }` updates correctly

**Component Tests (MainPanel.test.tsx):**
```typescript
// Test: Cancel button visible when isSending
useTabStore.setState({ tabs: [{ ...tab, responseState: { ...tab.responseState, isSending: true } }], activeTabId: tab.id });
render(<MainPanel />);
expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /^send$/i })).not.toBeInTheDocument();

// Test: Cancel does NOT persist to history
// Setup: invoke never resolves, click Cancel
// Assert: executeMock (persistHistoryEntry) not called

// Test: "Request cancelled" appears in response panel
useTabStore.setState({ tabs: [{ ...tab, responseState: { ...tab.responseState, wasCancelled: true } }], ... });
render(<MainPanel />);
expect(screen.getByText(/request cancelled/i)).toBeInTheDocument();
```

**Component Tests (ResponseViewer.test.tsx):**
```typescript
// Test: wasCancelled=true shows neutral cancelled state
render(<ResponseViewer response={null} error={null} wasCancelled={true} />);
expect(screen.getByText(/request cancelled/i)).toBeInTheDocument();
// Verify NOT using red/error styling
const el = screen.getByText(/request cancelled/i);
expect(el.closest('[class*="red"]')).toBeNull();
```

**Manual Testing Checklist:**
- [ ] Send to `https://httpbin.org/delay/10`, click Cancel immediately — should show "Request cancelled" instantly
- [ ] Send to a fast endpoint — should complete normally, no cancellation state
- [ ] Cancel, then immediately send again — should work (no stale AbortController interference)
- [ ] Open two tabs, start slow requests in both — cancel Tab 1, Tab 2 continues unaffected
- [ ] Verify Cancel button is amber (not green), shows spinner + "Cancel" label
- [ ] Verify "Request cancelled" message is neutral (not red error styling)

### Project Structure Notes

**New Files (none expected)** — All changes are modifications to existing files.

**Modified Files:**
- `fetch-boy/src/stores/tabStore.ts` — Add `wasCancelled: boolean` to `ResponseSnapshot`
- `fetch-boy/src/stores/tabStore.test.ts` — Test `wasCancelled` initialization
- `fetch-boy/src/components/MainPanel/MainPanel.tsx` — AbortController, cancel handler, button toggle, pass `wasCancelled` to ResponseViewer
- `fetch-boy/src/components/MainPanel/MainPanel.test.tsx` — Test cancel flow, cancelled state display
- `fetch-boy/src/components/ResponseViewer/ResponseViewer.tsx` — Add `wasCancelled` prop, render cancel state
- `fetch-boy/src/components/ResponseViewer/ResponseViewer.test.tsx` — Test cancelled state rendering
- `fetch-boy/src-tauri/Cargo.toml` — Add `tokio` dependency
- `fetch-boy/src-tauri/src/http.rs` — `CancellationRegistry`, modified `send_request`, new `cancel_request`
- `fetch-boy/src-tauri/src/lib.rs` — Register state + command

### References

- **Primary Source**: `_bmad-output/planning-artifacts/epic-6.md` (Story 6.2 acceptance criteria)
- **MainPanel**: `fetch-boy/src/components/MainPanel/MainPanel.tsx` (send flow, button JSX, invokeWithTimeout)
- **tabStore**: `fetch-boy/src/stores/tabStore.ts` (ResponseSnapshot interface, updateTabResponseState)
- **ResponseViewer**: `fetch-boy/src/components/ResponseViewer/ResponseViewer.tsx` (props interface, rendering)
- **Rust HTTP command**: `fetch-boy/src-tauri/src/http.rs` (send_request, SendRequestPayload)
- **Tauri entry point**: `fetch-boy/src-tauri/src/lib.rs` (state registration, command handlers)
- **Cargo dependencies**: `fetch-boy/src-tauri/Cargo.toml` (reqwest 0.12, tauri 2)
- **Previous Story**: `_bmad-output/implementation-artifacts/6-1-foldable-side-panel.md` (patterns, file list)
- **Keyboard shortcuts pattern**: `fetch-boy/src/hooks/useTabKeyboardShortcuts.ts` (hook pattern reference)

### Latest Technical Information

**AbortController + Promise.race (Browser/Web Standard):**
- `AbortController` / `AbortSignal` are standard Web APIs — fully available in Tauri's WebView (Chromium-based)
- `new DOMException('AbortError', 'AbortError')` is the standard way to create an abort error
- Check with `error instanceof DOMException && error.name === 'AbortError'`
- `signal.addEventListener('abort', handler)` fires synchronously when `abort()` is called

**Tauri v2 State Management:**
- `tauri::State<'_, T>` — zero-cost reference to managed state in command signatures
- `.manage(T)` in Builder chain — called once at app startup
- `state.0.lock()` — access inner Mutex value
- Thread-safe: multiple async commands can access state concurrently with `Mutex`

**reqwest 0.12 with tokio::select!:**
- `request_builder.send()` returns `impl Future` — compatible with `tokio::select!`
- `tokio::sync::oneshot::channel()` creates a one-time sender/receiver pair
- `tokio::select!` is available when `tokio` is a direct dependency with `macros` feature OR via tauri's re-export
- Add `tokio = { version = "1", features = ["sync"] }` to Cargo.toml for `oneshot` without pulling in full tokio runtime

**reqwest 0.12 cancellation:**
- reqwest does NOT have a built-in cancel API separate from dropping the future
- `tokio::select!` effectively drops the request future when the cancel branch wins — this closes the underlying TCP connection
- This is the idiomatic Rust cancellation pattern: drop the future = cancel the I/O

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

- Workflow: create-story (Story 6.2)
- Epic: 6 - Workspace Ergonomics & Developer Flow
- Previous Story: 6-1-foldable-side-panel
- Auto-generated context engine analysis completed

### Completion Notes List

_To be filled by dev agent during implementation_

### File List

_To be filled by dev agent after implementation_

## Change Log

- 2026-03-11: Story 6.2 context created via automated create-story workflow — comprehensive developer guide with Rust cancellation registry, AbortController race pattern, architecture compliance, and testing requirements

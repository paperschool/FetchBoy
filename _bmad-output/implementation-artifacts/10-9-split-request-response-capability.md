# Story 10.9: Split Request/Response Backend Capability

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the Rust backend to support returning separate request and response data structures,
so that the frontend can display intercepted requests and responses in a split-panel UI with full fidelity.

## Acceptance Criteria

1. [ ] Backend command or event emits request details separately from response details
2. [ ] Request data includes: method, URL, headers, body (if any), timestamp
3. [ ] Response data includes: status code, status text, headers, body, response time
4. [ ] Request and response are linked via a common ID
5. [ ] Backend can handle streaming/chunked responses
6. [ ] Binary response bodies are properly handled and encoded
7. [ ] Existing MITM proxy functionality continues to work (no regressions)
8. [ ] Unit tests cover the new splitting functionality

## Tasks / Subtasks

- [ ] Task 1: Analyze current http.rs and proxy.rs for split capability (AC: #1)
  - [ ] Task 1.1: Review SendResponsePayload structure
  - [ ] Task 1.2: Review proxy.rs InterceptHandler patterns
  - [ ] Task 1.3: Document current request/response flow
- [ ] Task 2: Design and implement request capture in proxy (AC: #1, #2)
  - [ ] Task 2.1: Create RequestEvent payload structure
  - [ ] Task 2.2: Emit request event before forwarding
  - [ ] Task 2.3: Link request to response via ID
- [ ] Task 3: Enhance response handling for split view (AC: #3, #4)
  - [ ] Task 3.1: Create ResponseEvent payload structure  
  - [ ] Task 3.2: Emit response event with request ID reference
  - [ ] Task 3.3: Ensure timing data is captured
- [ ] Task 4: Handle edge cases (AC: #5, #6)
  - [ ] Task 4.1: Implement chunked transfer encoding support
  - [ ] Task 4.2: Handle binary response bodies properly
  - [ ] Task 4.3: Handle large responses (streaming vs buffering)
- [ ] Task 5: Add tests and validation (AC: #7, #8)
  - [ ] Task 5.1: Unit tests for new event structures
  - [ ] Task 5.2: Integration tests for request/response pairing
  - [ ] Task 5.3: Verify existing proxy tests still pass
- [ ] Final Task - Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 10.9

## Dev Notes

### Investigation Findings

From analyzing the Rust backend:

**Current State:**
- `http.rs` - The `send_request` command returns a combined `SendResponsePayload` that includes both response status, headers, and body
- `proxy.rs` - The MITM proxy already separates request and response handling internally via:
  - `handle_request()` - Captures request details (method, URL, headers)
  - `handle_response()` - Captures response details (status, headers, body)
  - Uses `res.into_parts()` to split response for body inspection

**Key Code Patterns Found:**

In `proxy.rs`:
```rust
// Split response so we can buffer the body while preserving headers/status
let (parts, body) = res.into_parts();
// Collect response headers before parts is consumed
let response_headers = collect_headers(&parts.headers);
// Buffer the body bytes
let bytes: Bytes = body.collect().await.unwrap_or_default().to_bytes();
```

**Gap Identified:**
- The proxy currently emits a single `InterceptEvent` combining request/response
- No separate command exists to return request and response as distinct data structures
- Frontend receives combined data, not split request/response

### Technical Implementation Approach

**Option 1: Extend proxy events**
- Modify `InterceptHandler` to emit separate request and response events
- Frontend subscribes to both event types
- Requires event streaming infrastructure (already partially exists)

**Option 2: New Tauri command**
- Create `get_intercept_details(requestId)` command
- Returns structured request + response pair
- Useful for detailed inspection view

**Option 3: Hybrid approach**
- Keep current combined event for table view
- Add split data for detail view (on demand)

### Project Structure Notes

- Rust backend: `src-tauri/src/`
- Main files to modify: `proxy.rs`, possibly `lib.rs` for new commands
- Tests location: Inline in source files with `#[cfg(test)]` module
- No new dependencies expected (uses existing `hudsucker`, `hyper`, `http_body_util`)

### References

- [Source: src-tauri/src/proxy.rs] - MITM proxy implementation
- [Source: src-tauri/src/http.rs] - HTTP request/response handling
- [Epic 10: Intercept Control Features — Breakpoints & Request Editing](_bmad-output/planning-artifacts/epic-10.md)
- [Story 10.1: Intercept Split View with Request Table](_bmad-output/implementation-artifacts/10-1-intercept-split-view-with-request-table.md)
- [Story 10.2: Request Detail View with Subtabs](_bmad-output/implementation-artifacts/10-2-request-detail-view-with-subtabs.md)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

- src-tauri/src/proxy.rs (modify)
- src-tauri/src/http.rs (reference)
- src-tauri/src/lib.rs (possibly modify for new commands)

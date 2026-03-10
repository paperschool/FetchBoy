# Story 1.4: Send Request via Rust

Status: review

## Story

As a user building API requests in Dispatch,
I want the Send action to execute through a Rust Tauri command and render a full response panel,
so that requests bypass browser CORS limitations and I can inspect status, timing, size, headers, and response body reliably.

## Acceptance Criteria

1. Clicking Send invokes `send_request` Tauri command with current request state.
2. Response panel shows status code (colored), response time (ms), and response size.
3. Body tab shows raw response text.
4. Headers tab shows all response headers as a read-only table.
5. Network or transport errors display a user-readable message.
6. A history entry is written to the DB on each send.

Final Step: Commit all code and documentation changes for Story 1.4 before marking the story complete.

## Tasks / Subtasks

- [x] Task 1 - Add Rust-side request command and payload contracts (AC: 1, 5)
  - [x] Create Rust command module(s) in `src-tauri/src/` (for example `http.rs` and/or `commands.rs`) implementing `send_request`.
  - [x] Define serde payload structs for request input and response output (method, URL, headers/query/body/auth subset currently supported).
  - [x] Register command in Tauri builder and invoke handler wiring in `src-tauri/src/lib.rs`.
  - [x] Ensure command returns clear, user-displayable error text on failures/timeouts.

- [x] Task 2 - Wire frontend Send action to Tauri invoke (AC: 1, 5)
  - [x] Replace ad-hoc fetch-first send path in `src/components/MainPanel/MainPanel.tsx` with `@tauri-apps/api/core` `invoke('send_request', ...)` as primary path.
  - [x] Map current `requestStore` state into the command payload shape.
  - [x] Keep URL normalization/validation and show concise user-facing error messages.

- [x] Task 3 - Build response panel UI (AC: 2, 3, 4)
  - [x] Create response-viewer components under `src/components/ResponseViewer/`.
  - [x] Display status/timing/size summary strip with status color states (2xx success, 4xx warning, 5xx error).
  - [x] Add tabbed response content: `Body` (raw text) and `Headers` (read-only table).
  - [x] Integrate response panel into `MainPanel` without breaking request-builder tab behavior.

- [x] Task 4 - Persist history records per send (AC: 6)
  - [x] Use DB access pattern from `src/lib/db.ts` and existing `history` schema to insert one entry per successful/failed send attempt according to story behavior.
  - [x] Include method, URL, status code, response time, serialized request snapshot, and timestamp fields aligned with schema.
  - [x] Keep writes scoped to current story requirements (no restore or listing logic yet).

- [x] Task 5 - Add/extend tests for send flow and response rendering (AC: 1-6)
  - [x] Add component tests for Send trigger path and response summary rendering.
  - [x] Mock `invoke` for success and error scenarios.
  - [x] Add tests validating body/headers tab rendering in response panel.
  - [x] Add tests (or integration-level assertions) confirming history persistence calls are issued.

- [x] Task 6 - Validate quality gates (AC: 1-6)
  - [x] Run `yarn test`.
  - [x] Run `yarn typecheck`.
  - [x] Verify no regressions in request-builder tests from Story 1.3.

- [x] Final Task - Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 1.4.

## Dev Notes

### Story Foundation

- Epic 1 goal is end-to-end request/response backbone; Story 1.4 is the first complete transport-and-response slice.
- Story 1.3 delivered request composition UI/state and currently has a temporary Send implementation path; Story 1.4 should harden send behavior and response visualization.

### Technical Requirements

- Primary transport should be Rust-side command execution for desktop reliability and CORS bypass.
- Keep request payload shape explicit and typed on both sides (TypeScript + Rust serde structs).
- Preserve current request-store ownership of method/url/headers/query/body/auth-none state.
- Status/timing/size must be computed per request and surfaced in a stable response model.
- Error responses should remain user-readable; avoid exposing stack traces or opaque internal error codes directly.

### Architecture Compliance

- Follow project structure from spec:
  - Rust HTTP command logic in `src-tauri/src/` modules.
  - Frontend response UI in `src/components/ResponseViewer/`.
  - State in stores and focused view logic in components.
- Keep alias-based imports (`@/...`) and existing TypeScript strict mode compliance.
- Preserve existing request builder behavior and avoid broad refactors unrelated to ACs.

### Library And Framework Requirements

- Existing stack in use:
  - Tauri 2.x app shell and command bridge.
  - React 18 + TypeScript 5 + Vite 6.
  - Zustand 5 + Immer for state.
  - SQLite via `tauri-plugin-sql` for local persistence.
- Native HTTP implementation target from project spec is `reqwest` through Tauri command surface.
- Avoid adding new dependencies unless acceptance criteria require them.

### File Structure Requirements

- Likely Rust updates:
  - `src-tauri/src/lib.rs` (command registration)
  - `src-tauri/src/main.rs` (if needed for module exposure)
  - `src-tauri/src/http.rs` (new)
  - `src-tauri/src/commands.rs` (new or updated)
- Frontend updates:
  - `src/components/MainPanel/MainPanel.tsx`
  - `src/components/ResponseViewer/*` (new)
  - `src/stores/requestStore.ts` (if response state tracked there)
  - `src/lib/db.ts` or a small helper module for history inserts

### Testing Requirements

- Unit/component tests must cover:
  - Send invokes `send_request` with expected payload.
  - Success path renders status/timing/size and response body.
  - Error path renders readable message.
  - Headers tab renders read-only header entries.
  - History write path called once per send.
- Regression expectation:
  - Existing Story 1.3 store and MainPanel tests continue passing.

### Previous Story Intelligence

From Story 1.3 and recent follow-up work:

- `MainPanel` already includes Send trigger and request result message; convert this to command-backed flow instead of layering duplicate send logic.
- Global color tokens were introduced in `src/index.css`; response panel UI should use existing semantic classes for consistency.
- Current Send path attempted plugin/browser fetch fallback and still hit runtime "Load failed" in user testing; this reinforces moving to explicit Rust command path.
- Keep tests concise and behavior-focused; existing suite pattern uses Testing Library and direct store assertions.

### Git Intelligence Summary

- Recent commit `5bd3df8` established request builder and component/store patterns for Story 1.3.
- Files touched in prior story indicate intended extension points for this story:
  - `dispatch/src/components/MainPanel/MainPanel.tsx`
  - `dispatch/src/components/RequestBuilder/KeyValueRows.tsx`
  - `dispatch/src/stores/requestStore.ts`
- Use incremental extension of those patterns rather than introducing parallel abstractions.

### Latest Tech Information

- Current dependency baseline remains compatible for this story:
  - `@tauri-apps/api@^2.5.x`
  - `tauri-plugin-sql` 2.x (already wired)
  - `@tauri-apps/plugin-http` 2.x currently present but should not replace AC-required `send_request` command bridge.
- No framework migrations required; implementation focus is architecture correctness and transport reliability.

### Project Structure Notes

- `src/components/ResponseViewer/.gitkeep` exists and should be replaced with concrete response viewer components in this story.
- Keep request-builder and response-viewer concerns separated to avoid coupling and regression risk.

### References

- Epic source and Story 1.4 ACs: `_bmad-output/planning-artifacts/epic-1.md`
- Prior story implementation context: `_bmad-output/implementation-artifacts/1-3-basic-request-builder.md`
- Project transport target and command contract direction: `_bmad-output/api-client-spec.md` (Core Features, Tauri Commands, Data Models)
- Current request builder implementation: `dispatch/src/components/MainPanel/MainPanel.tsx`
- Current request state model: `dispatch/src/stores/requestStore.ts`

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- `git --no-pager log --oneline -n 5`
- `git --no-pager show --name-only --pretty=format:'%h %s' -n 1 5bd3df8`

### Completion Notes List

- Story selected automatically from sprint backlog order: `1-4-send-request-via-rust`.
- Context synthesized from Epic 1 requirements, Story 1.3 implementation, current codebase state, and recent commit intelligence.
- Guardrails emphasize replacing temporary fetch behavior with explicit Rust command architecture and adding response/history coverage.
- Verified AC coverage in implementation:
  - `send_request` Rust command implemented and registered via Tauri invoke handler.
  - Frontend Send action wired to `invoke('send_request')` with URL normalization and error messaging.
  - Response panel renders colored status, timing, size, raw body, and headers tab.
  - History persistence runs for both success and failure paths.
- Quality gates executed and passing:
  - `yarn test` (33 tests passing)
  - `yarn typecheck` (no errors)
- Story commit verified in git history: `820d67c feat: 1-4 + a number of other changes`.

### File List

- Updated: `dispatch/src-tauri/src/http.rs`
- Updated: `dispatch/src-tauri/src/lib.rs`
- Updated: `dispatch/src-tauri/src/main.rs`
- Updated: `dispatch/src-tauri/src/db.rs`
- Updated: `dispatch/src-tauri/Cargo.toml`
- Updated: `dispatch/src-tauri/Cargo.lock`
- Updated: `dispatch/src/components/MainPanel/MainPanel.tsx`
- Updated: `dispatch/src/components/MainPanel/MainPanel.test.tsx`
- Added: `dispatch/src/components/ResponseViewer/ResponseViewer.tsx`
- Added: `dispatch/src/lib/history.ts`
- Updated: `_bmad-output/implementation-artifacts/1-4-send-request-via-rust.md`

### Change Log

- 2026-03-10: Story moved to review after verifying all ACs, quality gates, and story commit presence.

# Story 5.6: Match Query Params from URL

Status: review

## Story

As a developer,
I want a Match Query Params action in the Query Params toolbar,
so that I can auto-populate query rows from the request URL instead of entering them manually.

## Acceptance Criteria

1. In Request Details -> Query Params, a button named `Match Query Params` is visible on the same toolbar row as `Add Query Param`, aligned to the right side.
2. Clicking `Match Query Params` parses the current request URL and replaces the query param rows with parsed URL params in URL order.
3. Parsed rows are stored as `{ key, value, enabled: true }`.
4. Query params without explicit values (example: `?flag`) are represented as `key: "flag"`, `value: ""`.
5. Repeated keys (example: `?tag=a&tag=b`) are preserved as separate rows.
6. If the URL has no query string, existing query rows are cleared.
7. If the URL is invalid/unparseable, query rows remain unchanged and a non-blocking inline validation message is shown near the button.
8. Matching marks the request as dirty in the same way manual query row edits do.
9. Behavior is covered by tests for valid URL parsing, empty query string, repeated keys, key-without-value, and invalid URL handling.

## Tasks / Subtasks

- [x] Task 1 - Add query param extraction utility (AC: 2, 3, 4, 5, 6, 7)
  - [x] Create `src/lib/extractQueryParamsFromUrl.ts`
  - [x] Export `extractQueryParamsFromUrl(rawUrl: string): { ok: true; params: Array<{ key: string; value: string; enabled: true }> } | { ok: false; error: string }`
  - [x] Parse with `URL` + `URLSearchParams`; if no protocol, retry using `https://` prefix before failing
  - [x] Preserve URL query order and duplicate keys
  - [x] Convert params with missing values to empty string values
  - [x] Return empty param array for URLs with no query string

- [x] Task 2 - Extend Query Params toolbar actions (AC: 1)
  - [x] Update `src/components/RequestBuilder/KeyValueRows.tsx` to support optional right-side toolbar actions
  - [x] Keep existing usage for Headers unchanged
  - [x] In Query Params usage, add secondary button label `Match Query Params` rendered on the same row as `Add Query Param`, right aligned

- [x] Task 3 - Integrate matching behavior in MainPanel (AC: 2, 3, 4, 5, 6, 7, 8)
  - [x] Update `src/components/MainPanel/MainPanel.tsx`
  - [x] Add handler `handleMatchQueryParams` that reads active request URL from tab request state
  - [x] Use extraction utility; on success call `updateReq({ queryParams: parsedParams, isDirty: true })`
  - [x] On extraction failure, do not mutate `queryParams`; set local inline error state shown next to the button
  - [x] Clear inline error when URL changes or when matching succeeds

- [x] Task 4 - Add tests for utility and UI behavior (AC: 9)
  - [x] Create `src/lib/extractQueryParamsFromUrl.test.ts`
  - [x] Add cases: valid URL, no query, repeated keys, key without value, URL with protocol missing, invalid URL
  - [x] Update `src/components/MainPanel/MainPanel.test.tsx`:
  - [x] Verify Query Params tab shows `Add Query Param` and `Match Query Params` controls on the same toolbar row
  - [x] Verify clicking `Match Query Params` populates query rows from URL
  - [x] Verify empty query clears rows
  - [x] Verify invalid URL keeps prior rows and shows inline error text

- [x] Task 5 - Verify and commit story changes
  - [x] Run `npx tsc --noEmit` from ``
  - [x] Run targeted tests for MainPanel and query extraction utility
  - [x] Commit all implementation and doc changes with a message including `Story 5.6`

## Dev Notes

### Existing integration points

- Query param controls are rendered in `src/components/MainPanel/MainPanel.tsx` through `KeyValueRows` with `addLabel="Add Query Param"`.
- Shared key/value rows UI is implemented in `src/components/RequestBuilder/KeyValueRows.tsx`.
- Query param state lives per active tab in `tabStore` request snapshots and is updated via `updateReq(...)` in MainPanel.

### Guardrails

- Do not mutate header row behavior while adding Query Params toolbar enhancements.
- Do not append parsed rows to existing rows; this story requires replacing rows to mirror URL source of truth.
- Preserve duplicate query keys and order from the URL.
- Keep error handling non-blocking and inline (no modal).
- Avoid introducing new dependencies; native URL APIs are sufficient.

### Test guidance

- Prefer deterministic assertions over snapshot tests for parsed query rows.
- Include at least one case with URL-encoded params to verify decode behavior from URLSearchParams.
- Ensure invalid URL path asserts that previous query rows remain intact.

### Project Structure Notes

- New utility: `src/lib/extractQueryParamsFromUrl.ts`
- Utility tests: `src/lib/extractQueryParamsFromUrl.test.ts`
- Main integration: `src/components/MainPanel/MainPanel.tsx`
- Shared row UI update: `src/components/RequestBuilder/KeyValueRows.tsx`
- Existing component tests to extend: `src/components/MainPanel/MainPanel.test.tsx`

### References

- Source: `_bmad-output/planning-artifacts/epic-5.md` (Story 5.6)
- Source: `src/components/MainPanel/MainPanel.tsx` (Query Params rendering and request updates)
- Source: `src/components/RequestBuilder/KeyValueRows.tsx` (toolbar row controls)
- Source: `src/stores/tabStore.ts` (per-tab request state)

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow: create-story
- Mode: automated context creation based on explicit feature request
- Dev workflow: bmm dev-story (Story 5.6)
- Validation: `npx tsc --noEmit` and `npx vitest run` (372 passed)

### Implementation Plan

- Added a focused parser utility to extract query params with protocol fallback and deterministic result shaping.
- Extended shared key/value toolbar to support right-aligned actions and non-blocking inline messages without altering header behavior.
- Wired Query Params match action in MainPanel to replace rows, preserve invalid-URL rows, and clear inline error on URL change/success.
- Added utility and MainPanel behavior tests for all acceptance-criteria parsing/edge cases.
- Updated TabBar test compatibility with current single-tab UX and adjusted TabBar close menu label matching.

### Completion Notes List

- Implemented `Match Query Params` end-to-end for Query Params toolbar and MainPanel behavior.
- Added `extractQueryParamsFromUrl` utility with URL parsing fallback and duplicate/order preservation.
- Added tests for valid, empty, repeated-key, key-without-value, missing-protocol, and invalid URL handling.
- Added inline non-blocking URL parsing error messaging near `Match Query Params` control.
- Verified no regressions with full test suite and typecheck.

### File List

- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/5-6-match-query-params-from-url.md (modified)
- src/lib/extractQueryParamsFromUrl.ts (new)
- src/lib/extractQueryParamsFromUrl.test.ts (new)
- src/components/RequestBuilder/KeyValueRows.tsx (modified)
- src/components/MainPanel/MainPanel.tsx (modified)
- src/components/MainPanel/MainPanel.test.tsx (modified)
- src/components/TabBar/TabBar.tsx (modified)
- src/components/TabBar/TabBar.test.tsx (modified)

## Change Log

- 2026-03-11: Implemented Story 5.6 query param matching workflow, tests, and validation updates; aligned TabBar close-last-tab test behavior with current UI.

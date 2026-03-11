# Story 5.6: Match Query Params from URL

Status: ready-for-dev

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

- [ ] Task 1 - Add query param extraction utility (AC: 2, 3, 4, 5, 6, 7)
  - [ ] Create `fetch-boy/src/lib/extractQueryParamsFromUrl.ts`
  - [ ] Export `extractQueryParamsFromUrl(rawUrl: string): { ok: true; params: Array<{ key: string; value: string; enabled: true }> } | { ok: false; error: string }`
  - [ ] Parse with `URL` + `URLSearchParams`; if no protocol, retry using `https://` prefix before failing
  - [ ] Preserve URL query order and duplicate keys
  - [ ] Convert params with missing values to empty string values
  - [ ] Return empty param array for URLs with no query string

- [ ] Task 2 - Extend Query Params toolbar actions (AC: 1)
  - [ ] Update `fetch-boy/src/components/RequestBuilder/KeyValueRows.tsx` to support optional right-side toolbar actions
  - [ ] Keep existing usage for Headers unchanged
  - [ ] In Query Params usage, add secondary button label `Match Query Params` rendered on the same row as `Add Query Param`, right aligned

- [ ] Task 3 - Integrate matching behavior in MainPanel (AC: 2, 3, 4, 5, 6, 7, 8)
  - [ ] Update `fetch-boy/src/components/MainPanel/MainPanel.tsx`
  - [ ] Add handler `handleMatchQueryParams` that reads active request URL from tab request state
  - [ ] Use extraction utility; on success call `updateReq({ queryParams: parsedParams, isDirty: true })`
  - [ ] On extraction failure, do not mutate `queryParams`; set local inline error state shown next to the button
  - [ ] Clear inline error when URL changes or when matching succeeds

- [ ] Task 4 - Add tests for utility and UI behavior (AC: 9)
  - [ ] Create `fetch-boy/src/lib/extractQueryParamsFromUrl.test.ts`
  - [ ] Add cases: valid URL, no query, repeated keys, key without value, URL with protocol missing, invalid URL
  - [ ] Update `fetch-boy/src/components/MainPanel/MainPanel.test.tsx`:
  - [ ] Verify Query Params tab shows `Add Query Param` and `Match Query Params` controls on the same toolbar row
  - [ ] Verify clicking `Match Query Params` populates query rows from URL
  - [ ] Verify empty query clears rows
  - [ ] Verify invalid URL keeps prior rows and shows inline error text

- [ ] Task 5 - Verify and commit story changes
  - [ ] Run `npx tsc --noEmit` from `fetch-boy/`
  - [ ] Run targeted tests for MainPanel and query extraction utility
  - [ ] Commit all implementation and doc changes with a message including `Story 5.6`

## Dev Notes

### Existing integration points

- Query param controls are rendered in `fetch-boy/src/components/MainPanel/MainPanel.tsx` through `KeyValueRows` with `addLabel="Add Query Param"`.
- Shared key/value rows UI is implemented in `fetch-boy/src/components/RequestBuilder/KeyValueRows.tsx`.
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

- New utility: `fetch-boy/src/lib/extractQueryParamsFromUrl.ts`
- Utility tests: `fetch-boy/src/lib/extractQueryParamsFromUrl.test.ts`
- Main integration: `fetch-boy/src/components/MainPanel/MainPanel.tsx`
- Shared row UI update: `fetch-boy/src/components/RequestBuilder/KeyValueRows.tsx`
- Existing component tests to extend: `fetch-boy/src/components/MainPanel/MainPanel.test.tsx`

### References

- Source: `_bmad-output/planning-artifacts/epic-5.md` (Story 5.6)
- Source: `fetch-boy/src/components/MainPanel/MainPanel.tsx` (Query Params rendering and request updates)
- Source: `fetch-boy/src/components/RequestBuilder/KeyValueRows.tsx` (toolbar row controls)
- Source: `fetch-boy/src/stores/tabStore.ts` (per-tab request state)

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow: create-story
- Mode: automated context creation based on explicit feature request

### Completion Notes List

- Created Story 5.6 implementation artifact with concrete ACs, tasks, and guardrails.
- Added Story 5.6 to Epic 5 planning artifact.
- Updated sprint status for Story 5.6 to `ready-for-dev`.

### File List

- _bmad-output/planning-artifacts/epic-5.md (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/5-6-match-query-params-from-url.md (new)

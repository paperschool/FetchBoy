# Story 1.3: Basic Request Builder

Status: review

## Story

As a user building API requests in Dispatch,
I want a request builder UI with method, URL, headers, query params, body, and auth tabs backed by the active request store,
so that I can compose complete HTTP requests before wiring send/response behavior in the next story.

## Acceptance Criteria

1. HTTP method dropdown shows: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.
2. URL input is a full-width text field.
3. Headers tab provides editable key-value rows with enabled toggle.
4. Query Params tab provides editable key-value rows.
5. Body tab provides plain textarea for raw input only (no Monaco/editor integration in this story).
6. Auth tab shows "None" placeholder only.
7. All fields read from and write to `requestStore`.

Final Step: Commit all code and documentation changes for Story 1.3 before marking the story complete.

## Tasks / Subtasks

- [x] Task 1 - Expand request store shape and actions (AC: 1, 3, 4, 5, 6, 7)
  - [x] Extend `src/stores/requestStore.ts` to include request builder fields:
    - `method`, `url`
    - `headers: Array<{ key: string; value: string; enabled: boolean }>`
    - `queryParams: Array<{ key: string; value: string; enabled: boolean }>`
    - `body: { mode: 'raw'; raw: string }`
    - `auth: { type: 'none' }`
    - `activeTab: 'headers' | 'query' | 'body' | 'auth'`
  - [x] Add focused setters/actions for each field and row-level edits (add, update, remove, toggle enabled).
  - [x] Keep existing `method` and `url` behavior stable for backward compatibility.

- [x] Task 2 - Build request builder UI in Main Panel (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] Replace placeholder content in `src/components/MainPanel/MainPanel.tsx` with:
    - method dropdown
    - full-width URL input
    - tab switcher for Headers / Query Params / Body / Auth
    - conditional tab content panels
  - [x] Wire all controls directly to `useRequestStore`.
  - [x] Keep Tailwind-only styling consistent with existing shell.

- [x] Task 3 - Add reusable row editor UI for key-value lists (AC: 3, 4, 7)
  - [x] Create a small presentational component for editable key-value rows under `src/components/RequestBuilder/`.
  - [x] Support add/remove rows and enabled toggle (headers require enabled toggle; query params can support same model for consistency).
  - [x] Ensure row updates are immutable through store actions.

- [x] Task 4 - Add/extend tests for store and request builder rendering (AC: 1-7)
  - [x] Update `src/stores/requestStore.test.ts` with new initial state and action tests.
  - [x] Add component tests for `MainPanel` request builder interactions (tab switching and two-way binding).
  - [x] Use Testing Library and Vitest patterns already used in repository.

- [x] Task 5 - Validate quality gates (AC: 1-7)
  - [x] Run `yarn test`.
  - [x] Run `yarn typecheck`.
  - [x] Confirm no regressions in existing `AppShell` tests.

- [x] Final Task - Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 1.3.

## Dev Notes

### Story Foundation

- Epic objective: establish the full request/response backbone; this story delivers request composition UI/state and is prerequisite for Story 1.4 send flow.
- Scope for this story is intentionally constrained:
  - Body supports raw text only.
  - Auth supports none only.
  - No persistence to DB yet.
  - No Monaco editor yet.

### Technical Requirements

- Keep request state centralized in Zustand + Immer (`src/stores/requestStore.ts`) to avoid prop-drilling across request builder tabs.
- Prefer explicit typed unions over open strings for method, tab, and body/auth modes where practical.
- Avoid introducing new UI libraries; current stack already includes React + Tailwind and local UI primitives.
- Follow strict TypeScript settings (`strict`, `noUnusedLocals`, `noUnusedParameters`) from `tsconfig.app.json`.

### Architecture Compliance

- Preserve existing layout composition:
  - `AppShell` orchestrates top-level regions.
  - `MainPanel` hosts request builder content.
- Keep alias-based imports (`@/...`) consistent with current project configuration.
- Maintain current formatting and code style in the file being edited (indentation and naming patterns).

### Library And Framework Requirements

- React 18 + Vite 6 + TypeScript 5.x.
- Zustand 5 with Immer middleware for store updates.
- Tailwind v4 utility classes for styling.
- Vitest + Testing Library for unit/component tests.
- Do not add new dependencies for this story unless absolutely required by acceptance criteria.

### File Structure Requirements

- Update existing files:
  - `src/components/MainPanel/MainPanel.tsx`
  - `src/stores/requestStore.ts`
  - `src/stores/requestStore.test.ts`
- Create request-builder-specific components in:
  - `src/components/RequestBuilder/`
- Keep components focused:
  - Container logic in `MainPanel` and store.
  - Row/table rendering in small presentational components.

### Testing Requirements

- Extend store tests to verify:
  - defaults for new fields
  - row add/update/remove behavior
  - enabled toggle behavior
  - tab selection behavior
- Add component tests to verify:
  - method and URL controls reflect store state and write back
  - tabs switch visible content
  - headers/query/body/auth interactions call store actions and update state
- Keep test environment assumptions aligned with `vitest.config.ts` (`jsdom`, setup file, alias resolution).

### Previous Story Intelligence

From Story 1.2 and current repository patterns:

- Preserve existing request store fields and tests while extending incrementally.
- Keep test mocks minimal and local; avoid over-mocking store behavior when simple integration-style component tests suffice.
- Continue using TypeScript-first data modeling (explicit interfaces/types) to prevent downstream ambiguity in Story 1.4.

### Git Intelligence Summary

- Most recent commits show active stabilization around DB integration and broad BMAD artifact generation.
- For this story, prioritize clean, narrowly scoped frontend/store changes over broad refactors.
- Follow existing naming conventions and folder layout to reduce churn in subsequent stories.

### Latest Tech Information

- Current project dependency set is already modern and compatible for this story scope:
  - `react@18.3.x`, `zustand@5.0.x`, `vitest@3.0.x`, `vite@6.2.x`.
- No framework migration is required for Story 1.3; implementation should stay within current stack boundaries.

### Project Structure Notes

- Existing placeholders indicate intended component destinations:
  - `src/components/RequestBuilder/.gitkeep`
  - `src/components/ResponseViewer/.gitkeep`
- Story 1.3 should fill request-builder-only areas and not pre-implement response-viewer behavior.

### References

- Source epic and acceptance criteria: `_bmad-output/planning-artifacts/epic-1.md` (Story 1.3 section)
- Previous story implementation notes: `_bmad-output/implementation-artifacts/1-2-sqlite-schema-and-migrations.md`
- Current request store: `dispatch/src/stores/requestStore.ts`
- Current main panel placeholder: `dispatch/src/components/MainPanel/MainPanel.tsx`
- Test setup and standards: `dispatch/vitest.config.ts`

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- `npx vitest run src/stores/requestStore.test.ts src/components/MainPanel/MainPanel.test.tsx` (RED then GREEN cycle)
- `yarn test`
- `yarn typecheck`

### Completion Notes List

- Implemented request-builder state model with typed methods/tabs and row-level actions in `useRequestStore`.
- Replaced main panel placeholder with method selector, URL field, tab navigation, headers/query/body/auth tab content.
- Added reusable `KeyValueRows` component for headers and query params editor interactions.
- Added/extended tests for store behavior and request-builder UI interactions.
- Full validation passed: 26 tests green and TypeScript typecheck green.

### File List

- Modified: `_bmad-output/implementation-artifacts/1-3-basic-request-builder.md`
- Modified: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Modified: `dispatch/src/components/MainPanel/MainPanel.tsx`
- Added: `dispatch/src/components/MainPanel/MainPanel.test.tsx`
- Added: `dispatch/src/components/RequestBuilder/KeyValueRows.tsx`
- Modified: `dispatch/src/stores/requestStore.ts`
- Modified: `dispatch/src/stores/requestStore.test.ts`

## Change Log

- 2026-03-10: Implemented Story 1.3 request builder UI/state/test coverage; moved story to review.

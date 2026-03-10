# Story 2.3: Save and Load Requests

Status: review

## Story

As a developer using Dispatch,
I want to save the current request to a collection and load any saved request by clicking it in the sidebar,
so that I can persist and quickly restore requests without re-entering details from scratch.

## Acceptance Criteria

1. "Save" action opens a dialog to choose collection/folder and set a request name.
2. Saving a request that already exists in a collection prompts overwrite confirmation.
3. Clicking a request in the sidebar loads it as the active request.
4. Loaded request populates all tabs (method, URL, headers, params, body, auth).
5. Unsaved changes prompt a "discard?" confirmation before loading another request.

Final Step: Commit all code and documentation changes for Story 2.3 before marking the story complete.

## Tasks / Subtasks

- [ ] Task 1 - Extend `requestStore` with dirty state and load action (AC: 4, 5)
  - [ ] Add `isDirty: boolean` field to `RequestState`, defaulting to `false`.
  - [ ] Widen `auth` state type from `{ type: 'none' }` to the full union `AuthState` matching the `Request.auth_type` + `auth_config` fields (see Dev Notes).
  - [ ] Widen `body.mode` type to match `Request.body_type` (none | raw | json | form-data | urlencoded).
  - [ ] Add `loadFromSaved(request: Request): void` action that sets all fields atomically and resets `isDirty` to `false`.
  - [ ] Add `markDirty(): void` action (or inline `isDirty = true` inside every mutation setter).
  - [ ] Set `isDirty = true` inside each existing mutation action: `setMethod`, `setUrl`, `setBodyRaw`, `addHeader`, `updateHeader`, `removeHeader`, `addQueryParam`, `updateQueryParam`, `removeQueryParam`.

- [ ] Task 2 - Add `updateSavedRequest` helper to `collections.ts` (AC: 2)
  - [ ] Add `updateSavedRequest(id: string, data: Partial<Omit<Request, 'id' | 'created_at'>>): Promise<void>` that issues an `UPDATE requests SET ...` SQL statement for all mutable fields.
  - [ ] Serialize `headers`, `query_params`, `auth_config` to JSON strings before writing, matching the deserialisation pattern already in `deserializeRequest`.
  - [ ] Update `updated_at` to `now()` on every call.

- [ ] Task 3 - Build `SaveRequestDialog` component (AC: 1, 2)
  - [ ] Create `dispatch/src/components/SaveRequestDialog/SaveRequestDialog.tsx`.
  - [ ] Props interface: `{ open: boolean; onClose: () => void; onSave: (name: string, collectionId: string, folderId: string | null) => Promise<void> }`.
  - [ ] Render a native `<dialog>` element (or implement using a simple overlay `<div>` with a portal) — shadcn/ui `Dialog` is **not** available yet (only `button.tsx` exists in `src/components/ui/`); keep it simple.
  - [ ] Show a collection selector (dropdown from `collectionStore.collections`), an optional folder selector (filtered by selected collection), and a request name input.
  - [ ] "Save" button disabled when name is empty or no collection selected.
  - [ ] Notify parent via `onSave`; close on success or explicit cancel.

- [ ] Task 4 - Wire Save button into `MainPanel` (AC: 1, 2, 5)
  - [ ] Add a "Save" button to `MainPanel.tsx` alongside the existing Send button (expand the `grid-cols-[8rem_1fr_auto]` grid or add the button within the same auto column).
  - [ ] On click: if `isDirty` is false and `activeRequestId` is set, you may skip the dialog and call save immediately; otherwise open `SaveRequestDialog`.
  - [ ] Inside the save handler: check `collectionStore.requests` for an existing entry matching `name + collection_id (+ folder_id)`. If found, call `window.confirm('A request with this name already exists. Overwrite?')`. On confirm → `updateSavedRequest`; on cancel → abort. On no match → `createSavedRequest` (but use the new `createFullSavedRequest` variant — see Task 5).
  - [ ] After a successful save, call `requestStore.markDirty()` with `false` (or use `loadFromSaved` to canonically clear dirty), then call `collectionStore.setActiveRequest(savedRequest.id)` and `collectionStore.addRequest(savedRequest)` (for new saves) or `collectionStore.updateRequest` (for overwrites).
  - [ ] Add `updateRequest` action to `collectionStore` if not already present (update name/fields of existing request in store state without removing + re-adding).

- [ ] Task 5 - Add `createFullSavedRequest` to `collections.ts` (AC: 1)
  - [ ] The existing `createSavedRequest(colId, name, folderId)` only inserts stub data with empty method/url/etc.
  - [ ] Add `createFullSavedRequest(request: Omit<Request, 'id' | 'created_at' | 'updated_at'>): Promise<Request>` that inserts all fields (method, url, headers, query_params, body_type, body_content, auth_type, auth_config, sort_order) into SQLite.
  - [ ] Use `crypto.randomUUID()` for `id` and `now()` for timestamps, consistent with existing helpers.

- [ ] Task 6 - Wire request click in `CollectionTree` to load request (AC: 3, 4, 5)
  - [ ] In `CollectionTree.tsx`, add an `onClick` handler to each `TreeRequest` row element.
  - [ ] On click: get the full `Request` object from `collectionStore.requests` by `id`.
  - [ ] **Dirty guard**: if `requestStore.isDirty` is `true`, call `window.confirm('You have unsaved changes. Discard and load this request?')`. If user cancels → return without loading.
  - [ ] On proceed: call `requestStore.loadFromSaved(request)` and `collectionStore.setActiveRequest(request.id)`.
  - [ ] The sidebar active highlight already uses `activeRequestId`; no extra highlight work needed.

- [ ] Task 7 - Add/extend tests (AC: 1–5)
  - [ ] `requestStore.test.ts` (existing) — add tests for: `loadFromSaved` populates all fields; `isDirty` flips true on mutation and false after `loadFromSaved`; widened auth/body types round-trip correctly.
  - [ ] `collections.test.ts` (existing) — add tests for `updateSavedRequest` and `createFullSavedRequest` using the existing mock pattern.
  - [ ] `SaveRequestDialog.test.tsx` (new) — cover: renders collection list; Save disabled when name empty; calls `onSave` with correct args; overwrite confirm shown; cancel closes dialog.
  - [ ] `CollectionTree.test.tsx` (existing or new) — add: click on a request calls `loadFromSaved`; dirty-guard confirm shown; cancel prevents load.

- [ ] Task 8 - Quality gates
  - [ ] Run `yarn test` from `dispatch/` — all tests pass.
  - [ ] Run `yarn typecheck` from `dispatch/` — no TypeScript errors.
  - [ ] Run `yarn tauri dev` — smoke-test full save and load flow.

- [ ] Final Task - Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 2.3.

## Dev Notes

### Story Foundation

- Epic 2 Story 2.3 builds directly on the collections infrastructure from Story 2.2 (`collectionStore`, `collections.ts`, `CollectionTree`). All tree CRUD and SQLite helpers already exist — do **not** reimplement them.
- The `createSavedRequest` function in `collections.ts` currently creates a skeleton request (empty method/url/etc.). Story 2.3 needs a "full save" variant (`createFullSavedRequest`) that serializes the current request builder state. Keep `createSavedRequest` intact to avoid breaking existing CollectionTree "add" flow.
- `collectionStore` already has `setActiveRequest(id)` for sidebar highlighting. All you need is to call it from the load path alongside `requestStore.loadFromSaved(...)`.

### Critical: requestStore Auth and Body Type Widening

The current `requestStore.ts` has severely narrowed auth and body types that **must** be widened to support AC4:

**Current (must change):**
```typescript
auth: {
    type: 'none';
};
body: {
    mode: 'raw';
    raw: string;
};
```

**Required auth type union:**
```typescript
export type AuthState =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'api-key'; key: string; value: string; in: 'header' | 'query' };
```

**Required body type union (align with `Request.body_type`):**
```typescript
export type BodyMode = 'none' | 'raw' | 'json' | 'form-data' | 'urlencoded';
body: {
    mode: BodyMode;
    raw: string;
};
```

**`loadFromSaved` must convert `Request.auth_config` (a `Record<string, string>`) into the appropriate `AuthState` shape:**
```typescript
function authConfigToState(authType: Request['auth_type'], authConfig: Record<string, string>): AuthState {
    switch (authType) {
        case 'bearer': return { type: 'bearer', token: authConfig['token'] ?? '' };
        case 'basic':  return { type: 'basic', username: authConfig['username'] ?? '', password: authConfig['password'] ?? '' };
        case 'api-key': return { type: 'api-key', key: authConfig['key'] ?? '', value: authConfig['value'] ?? '', in: (authConfig['in'] as 'header' | 'query') ?? 'header' };
        default:       return { type: 'none' };
    }
}
```

**MainPanel.tsx currently builds `requestSnapshot` with `auth_config: {}` and passes `auth` directly to `invoke('send_request', ...)`.** After widening, ensure `invoke` still receives the correct shape the Rust command expects. Do not change the `invoke` call shape — only the store type definition and the `loadFromSaved` converter need to change.

**Check `MainPanel.tsx` line ~140:** `auth_type: auth.type` — this currently works because `auth.type` is always `'none'`. After widening, the type still `.type` access is valid for all union members, so this line is safe.

### Architecture Compliance

- Follow alias imports (`@/...`) throughout — no relative `../../` paths.
- All stores are Zustand + Immer — `requestStore` changes must stay inside the `immer((set) => ...)` callback.
- SQLite writes go through `getDb()` in `@/lib/db` — do not import Database directly in components.
- All persistence helpers live in `@/lib/collections.ts` — add `updateSavedRequest` and `createFullSavedRequest` there.
- `crypto.randomUUID()` is available in the Tauri WebView runtime (Chromium) — use it for new IDs, consistent with `collections.ts`.

### File Structure Requirements

**New files:**
- `dispatch/src/components/SaveRequestDialog/SaveRequestDialog.tsx`
- `dispatch/src/components/SaveRequestDialog/SaveRequestDialog.test.tsx`

**Modified files:**
- `dispatch/src/stores/requestStore.ts` (auth/body widening, `isDirty`, `loadFromSaved`)
- `dispatch/src/stores/requestStore.test.ts` (new test cases)
- `dispatch/src/lib/collections.ts` (`updateSavedRequest`, `createFullSavedRequest`)
- `dispatch/src/lib/collections.test.ts` (new test cases)
- `dispatch/src/stores/collectionStore.ts` (add `updateRequest` action if not present)
- `dispatch/src/components/CollectionTree/CollectionTree.tsx` (request click → load + dirty guard)
- `dispatch/src/components/MainPanel/MainPanel.tsx` (Save button + dialog wiring)

### Library and Framework Requirements

- **Zustand + Immer** (`zustand`, `immer`) — already installed, use for all store changes.
- **shadcn/ui** — only `button.tsx` is currently generated at `src/components/ui/`. Do **not** generate new shadcn components for this story. Implement the dialog with a simple overlay `<div>` + backdrop or a native `<dialog>` element.
- **No new dependencies** — everything needed is already in the project.
- React 18, TypeScript 5, Tauri 2, Vite 6 — unchanged.

### Dialog Implementation Notes (No shadcn Dialog yet)

Implement `SaveRequestDialog` using a simple strategy:

```tsx
// Simple overlay approach — consistent with the project's current UI simplicity
export function SaveRequestDialog({ open, onClose, onSave }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-app-main border-app-subtle rounded-md border p-6 w-96 space-y-4" role="dialog" aria-modal="true">
        {/* collection selector, folder selector, name input, buttons */}
      </div>
    </div>
  );
}
```

The `bg-app-main`, `border-app-subtle`, `text-app-primary` CSS custom-property classes are already used in `MainPanel.tsx` and `CollectionTree.tsx`. Reuse them for consistent theming.

### Testing Requirements

- Mock `@/lib/collections` (already mocked in `__mocks__` or inline `vi.mock`) and `@/stores/collectionStore` in `SaveRequestDialog` and `CollectionTree` tests.
- For `requestStore.test.ts` — test `loadFromSaved` with a fixture covering all auth types and body modes.
- For `CollectionTree.test.tsx` — use `vi.spyOn(window, 'confirm')` to test the dirty-guard confirmation path, consistent with how `window.confirm` was tested in Story 2.2.
- Do not add snapshot tests — the project avoids them per prior story patterns.

### Previous Story Intelligence (Story 2.2)

- `window.confirm` is used directly in `CollectionTree.tsx` for delete confirmations. Follow the same pattern for the dirty-guard and overwrite confirmations — no custom confirm modal needed.
- Story 2.2 used HTML5 native DnD — CollectionTree already has `draggable`, `onDragStart`, `onDragOver`, `onDrop` props on request rows. Add `onClick` **without** conflicting with drag start. Guard: only treat as a click if `e.defaultPrevented` is false or use a flag to suppress click after a drag operation.
- `collectionStore.ts` is fully implemented with `loadAll`, `setActiveRequest`, `addRequest`, `renameRequest`, `deleteRequest`, `reorderRequests`. Add `updateRequest(id, changes)` as a new action (updates existing request in `state.requests` array by id).
- `collections.ts` uses `deserializeRequest` for JSON parsing — reuse it in `updateSavedRequest` if needed for round-trip safety, but note that `update` only writes, not reads.
- Tests use Vitest + `@testing-library/react`. The mock for `@tauri-apps/plugin-sql` lives at `src/test/` or inline `vi.mock`. Follow the same mock setup as Story 2.2 tests.

### Git Intelligence Summary

- Recent commits: `a849127` (tracking update), `8bded00` (Story 2.2 full implementation), `38eb74b` (bug fixes and UI changes), `3d58200` (Story 2.1 tracking), `a4e8917` (Monaco).
- Story 2.2 (`8bded00`) added `sort_order` to `Request` interface and `dispatch/src-tauri/migrations/001_initial.sql` already has all needed table columns (`method`, `url`, `headers`, `query_params`, `body_type`, `body_content`, `auth_type`, `auth_config`, `sort_order`). No migrations required for this story.
- Story 2.2 file list shows `dispatch/src/components/MainPanel/MainPanel.tsx` was modified to add `sort_order: 0` to the requestSnapshot — this is the snapshot you will augment further when passing full save data.

### Project Structure Notes

- No `project-context.md` found — epics and existing source files are authoritative.
- `dispatch/src/components/SaveRequestDialog/` does not exist yet — you must create it.
- `dispatch/src/stores/collectionStore.ts` at its current end does **not** have an `updateRequest` action in the interface — add it in the `CollectionState` interface and the store implementation.
- `dispatch/src/stores/historyStore.ts` is currently empty — do not touch it in this story.
- `dispatch/src/components/HistoryPanel/` is a placeholder — do not touch it in this story.

### References

- Story and AC source: [_bmad-output/planning-artifacts/epic-2.md](_bmad-output/planning-artifacts/epic-2.md)
- Product spec (Collections, Data Models): [_bmad-output/api-client-spec.md](_bmad-output/api-client-spec.md)
- Request state store: `dispatch/src/stores/requestStore.ts`
- Collection store: `dispatch/src/stores/collectionStore.ts`
- DB types and SQLite entrypoint: `dispatch/src/lib/db.ts`
- SQLite CRUD helpers: `dispatch/src/lib/collections.ts`
- Tree UI component: `dispatch/src/components/CollectionTree/CollectionTree.tsx`
- Request builder and Send button: `dispatch/src/components/MainPanel/MainPanel.tsx`
- Prior story (2.2) implementation: [_bmad-output/implementation-artifacts/2-2-collections-sidebar.md](_bmad-output/implementation-artifacts/2-2-collections-sidebar.md)
- Existing schema: `dispatch/src-tauri/migrations/001_initial.sql`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- `git --no-pager log --oneline -n 7`

### Completion Notes List

- Story selected from explicit user input `2-3`, resolved to `2-3-save-and-load-requests`.
- Context synthesized from: Epic 2 story requirements, sprint-status.yaml, api-client-spec.md, Story 2.2 learnings, full reads of `requestStore.ts`, `collectionStore.ts`, `collections.ts`, `db.ts`, `CollectionTree.tsx`, `MainPanel.tsx`.
- Critical guardrail identified: `requestStore.auth` is narrowed to `{ type: 'none' }` and `body.mode` to `'raw'` — both must be widened before AC4 (populate auth tab) is achievable.
- `createSavedRequest` creates skeleton requests only — dev must add `createFullSavedRequest` for saving the actual current request state.
- Only `button.tsx` exists in shadcn/ui — dialog must be implemented as a simple overlay, no new shadcn components needed.
- Dirty-guard and overwrite confirmation use `window.confirm` consistent with Story 2.2 delete patterns.
- Ultimate context engine analysis completed — comprehensive developer guide created.

### File List

- `dispatch/src/stores/requestStore.ts` — added AuthState, BodyMode, isDirty, loadFromSaved, markDirty; all mutations set isDirty
- `dispatch/src/lib/collections.ts` — added updateSavedRequest, createFullSavedRequest
- `dispatch/src/stores/collectionStore.ts` — added updateRequest action
- `dispatch/src/components/SaveRequestDialog/SaveRequestDialog.tsx` — new component
- `dispatch/src/components/MainPanel/MainPanel.tsx` — Save button, dialog wiring, handleDialogSave
- `dispatch/src/components/CollectionTree/CollectionTree.tsx` — handleLoadRequest with dirty guard
- `dispatch/src/components/ResponseViewer/ResponseViewer.tsx` — split error display into separate elements
- `dispatch/src/stores/requestStore.test.ts` — added 15 new tests
- `dispatch/src/lib/collections.test.ts` — added tests for new functions
- `dispatch/src/components/CollectionTree/CollectionTree.test.tsx` — added load/dirty guard tests
- `dispatch/src/components/SaveRequestDialog/SaveRequestDialog.test.tsx` — new (12 tests)
- `dispatch/src/components/MainPanel/MainPanel.test.tsx` — updated mocks and assertions

### Change Log

- 2026-03-10: Story created and moved to ready-for-dev.
- 2025-07-10: Implemented by dev agent (Amelia). All 8 tasks completed. 115 tests passing. Status moved to review.

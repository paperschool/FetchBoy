# Story 3.1: Environment Manager

Status: review

<!-- Validation: optional. Run validate-create-story checklist before dev-story if desired. -->

## Story

As a developer using Dispatch,
I want to create, edit, and delete named environments with key-value variable stores and activate one from the top bar,
so that I can switch between dev/staging/prod contexts without editing my requests manually.

## Acceptance Criteria

1. Top bar contains an environment selector dropdown showing the active environment name (or "No Environment" when none is active).
2. Creating an environment gives it a default name like "New Environment" and opens it for editing immediately.
3. Each environment can be renamed (inline) and deleted (with `window.confirm` guard).
4. Each environment has an editable variable table with `key`, `value`, and `enabled` (checkbox) columns; rows can be added and removed.
5. Selecting an environment from the top bar dropdown makes it the active environment; `is_active` is persisted to SQLite with a two-step UPDATE (clear all, then set one).
6. Switching environments updates `environmentStore.activeEnvironmentId` immediately in the UI.
7. On app start, all environments are loaded from SQLite and the active one (if any) is pre-selected in the selector.
8. Import/export of environments is **out of scope** — deferred to Story 4.2.

Final Step: Commit all code and documentation changes for Story 3.1 before marking the story complete.

## Tasks / Subtasks

- [x] Task 1 - Create `dispatch/src/lib/environments.ts` with CRUD helpers (AC: 2, 3, 5, 7)
  - [x] Define a `RawEnvironment` internal interface: same as `Environment` but `variables: string` (JSON TEXT) and `is_active: number` (0 or 1 from SQLite INTEGER).
  - [x] Add `loadAllEnvironments(): Promise<Environment[]>` — `SELECT * FROM environments ORDER BY created_at ASC`; `JSON.parse` each `variables` field; map `is_active` from `1/0` to `true/false`.
  - [x] Add `createEnvironment(name: string): Promise<Environment>` — INSERT with `crypto.randomUUID()` id, `now()` for `created_at`, `variables = '[]'`, `is_active = 0`. Return the constructed `Environment` object.
  - [x] Add `renameEnvironment(id: string, name: string): Promise<void>` — `UPDATE environments SET name = ? WHERE id = ?`.
  - [x] Add `deleteEnvironment(id: string): Promise<void>` — `DELETE FROM environments WHERE id = ?`.
  - [x] Add `updateEnvironmentVariables(id: string, variables: KeyValuePair[]): Promise<void>` — `UPDATE environments SET variables = ? WHERE id = ?`, serializing array via `JSON.stringify`.
  - [x] Add `setActiveEnvironment(id: string | null): Promise<void>` — two DB calls: `UPDATE environments SET is_active = 0` (clear all), then if `id !== null`: `UPDATE environments SET is_active = 1 WHERE id = ?`. See Dev Notes for why this two-step pattern is correct.

- [x] Task 2 - Fill `dispatch/src/stores/environmentStore.ts` (AC: 4, 5, 6)
  - [x] The file currently exists but is **completely empty** — write the full store from scratch.
  - [x] Use `create<EnvironmentState>()(immer((set) => ({...})))` — same pattern as `historyStore.ts` and `collectionStore.ts`.
  - [x] State: `environments: Environment[]`, `activeEnvironmentId: string | null`.
  - [x] Actions:
    - `loadAll(environments: Environment[]): void` — replaces `state.environments`; derives `activeEnvironmentId` by finding the env where `is_active === true` (or `null` if none).
    - `addEnvironment(env: Environment): void` — `state.environments.push(env)`.
    - `renameEnvironment(id: string, name: string): void` — find by id, mutate `name`.
    - `deleteEnvironment(id: string): void` — filter out; if the deleted id matches `activeEnvironmentId`, set `activeEnvironmentId = null`.
    - `updateVariables(id: string, variables: KeyValuePair[]): void` — find env by id; replace its `variables`.
    - `setActive(id: string | null): void` — sets `activeEnvironmentId = id`; flips `is_active` on all environments in state (true for matching id, false for all others).
  - [x] Export `useEnvironmentStore`.

- [x] Task 3 - Build `EnvironmentPanel` component (AC: 2, 3, 4)
  - [x] Create `dispatch/src/components/EnvironmentPanel/EnvironmentPanel.tsx`.
  - [x] Props interface: `{ open: boolean; onClose: () => void }`.
  - [x] Render a modal overlay: fixed inset, `bg-black/50` backdrop, centered card `max-w-2xl w-full bg-app-sidebar rounded shadow-lg p-4`. Check existing color token names in `index.css` or `tailwind.config` — use tokens that already exist (e.g. `bg-app-sidebar`, `text-app-primary`).
  - [x] **Layout**: two-column flex — left pane (environment list, ~30% width) and right pane (variable editor, remaining width). A `<div className="flex gap-4">` inner container works.
  - [x] **Left pane — environment list**:
    - Read `environments` from `useEnvironmentStore`.
    - Each row: environment name text (click to set local `selectedEnvId` state); inline rename via `<input>` triggered on double-click (blur/Enter saves via `renameEnvironment(id, name)` + `environmentStore.renameEnvironment(id, name)`); delete button (🗑 or "×") with `window.confirm('Delete this environment?')` — on confirm: `deleteEnvironment(id)` then `environmentStore.deleteEnvironment(id)`.
    - "New Environment" button at bottom: calls `createEnvironment('New Environment')` → `environmentStore.addEnvironment(env)` → auto-selects the new env for editing (set `selectedEnvId = env.id`).
    - Empty state: "No environments yet."
  - [x] **Right pane — variable editor**:
    - Shows variables of the currently `selectedEnvId` env.
    - Table rows: `key` text input, `value` text input, `enabled` checkbox, delete button.
    - On any field change: build updated `KeyValuePair[]`, call `updateEnvironmentVariables(id, updated)` then `environmentStore.updateVariables(id, updated)`.
    - "Add Variable" button appends `{ key: '', value: '', enabled: true }` row and immediately saves.
    - Delete row: remove from array, save immediately.
    - Empty state (no env selected): `"Select an environment to edit its variables."` centred text.
  - [x] Modal close: clicking backdrop or a "Close" button calls `onClose`.
  - [x] **Do NOT** use shadcn `Dialog` — only `button.tsx` exists in `src/components/ui/`. Keep layout in plain Tailwind.

- [x] Task 4 - Add environment selector to `TopBar.tsx` (AC: 1, 5, 6)
  - [x] Import `useEnvironmentStore` from `@/stores/environmentStore` and `setActiveEnvironment` from `@/lib/environments`.
  - [x] Import `EnvironmentPanel` from `@/components/EnvironmentPanel/EnvironmentPanel`.
  - [x] Add local `const [panelOpen, setPanelOpen] = useState(false)`.
  - [x] In the JSX, alongside the existing "Fetch Boy 🦴" heading, add a right-side flex group:
    - A native `<select>` with controlled `value={activeEnvironmentId ?? ''}`:
      - First option: `<option value="">No Environment</option>`
      - Map environments: `<option key={env.id} value={env.id}>{env.name}</option>`
    - `onChange`: call `await setActiveEnvironment(newId || null)` then `environmentStore.getState().setActive(newId || null)`. Wrap in an async arrow or use `void` pattern.
    - A small "Manage" button (or ⚙ icon) next to the select: `onClick={() => setPanelOpen(true)}`.
  - [x] Render `{panelOpen && <EnvironmentPanel open={panelOpen} onClose={() => setPanelOpen(false)} />}` at the end of the TopBar return, inside (or adjacent to) the `<header>` element.
  - [x] Apply consistent styling: `text-xs text-app-inverse bg-transparent border border-white/20 rounded px-2 py-1` for the select (dark background top bar).

- [x] Task 5 - Load environments on app startup in `AppShell.tsx` (AC: 7)
  - [x] Import `loadAllEnvironments` from `@/lib/environments` and `useEnvironmentStore` from `@/stores/environmentStore`.
  - [x] Add a `useEffect` with empty deps array (run once on mount):
    ```typescript
    useEffect(() => {
      loadAllEnvironments()
        .then((envs) => useEnvironmentStore.getState().loadAll(envs))
        .catch(() => {}); // swallow gracefully — not available in test env
    }, []);
    ```
  - [x] Keep existing component structure — just add the effect at the top of `AppShell`.

- [x] Task 6 - Add/extend tests (AC: 1–8)
  - [x] `dispatch/src/lib/environments.test.ts` (new):
    - Mock `@/lib/db` inline: `vi.mock('@/lib/db', () => ({ getDb: vi.fn() }))`. Have `getDb` resolve to a mock DB object with `select` and `execute` as `vi.fn()`.
    - `loadAllEnvironments`: seed 2 raw rows with `variables` as JSON string and `is_active` as 0/1; assert result has `variables` as `KeyValuePair[]`, `is_active` as boolean, correct ORDER.
    - `createEnvironment`: assert `db.execute` called with INSERT SQL containing correct columns; assert returned env has `variables: []`, `is_active: false`.
    - `renameEnvironment`: assert `db.execute` called with UPDATE WHERE id.
    - `deleteEnvironment`: assert `db.execute` called with DELETE WHERE id.
    - `updateEnvironmentVariables`: assert `db.execute` called with JSON-stringified variables in UPDATE.
    - `setActiveEnvironment(id)`: assert exactly two `db.execute` calls — first clears all (`is_active = 0`), second sets one (`is_active = 1 WHERE id = ?`).
    - `setActiveEnvironment(null)`: assert only one `db.execute` call — clear all only.
  - [x] `dispatch/src/stores/environmentStore.test.ts` (new):
    - Test `loadAll` populates `environments` and sets `activeEnvironmentId` from `is_active`.
    - Test `loadAll` with no active env → `activeEnvironmentId = null`.
    - Test `addEnvironment` appends to array.
    - Test `renameEnvironment` mutates name for correct id.
    - Test `deleteEnvironment` removes from array; if active → `activeEnvironmentId = null`.
    - Test `deleteEnvironment` of non-active env → `activeEnvironmentId` unchanged.
    - Test `updateVariables` replaces variables for correct env only.
    - Test `setActive(id)` sets `activeEnvironmentId`; flips `is_active` on matching env, clears others.
    - Test `setActive(null)` sets `activeEnvironmentId = null`; all `is_active = false`.
  - [x] `dispatch/src/components/EnvironmentPanel/EnvironmentPanel.test.tsx` (new):
    - Mock `@/lib/environments` and `@/stores/environmentStore`.
    - Render with `open=false` → nothing rendered (or null check).
    - Render with `open=true`, empty environments → "No environments yet." shown.
    - Render with 2 environments → 2 rows visible.
    - Click "New Environment" → `createEnvironment` called; `addEnvironment` called.
    - Click delete → `window.confirm` shown; confirm → `deleteEnvironment` + `environmentStore.deleteEnvironment` called; cancel → not called.
    - Click environment row → variable editor shown for that env.
    - Add a variable row → `updateEnvironmentVariables` + `environmentStore.updateVariables` called.
    - Click close → `onClose` prop called.
  - [x] `dispatch/src/components/TopBar/TopBar.test.tsx` (new):
    - Mock `@/stores/environmentStore` and `@/lib/environments`.
    - Renders selector with "No Environment" as default option.
    - Change selector value → `setActiveEnvironment` + `environmentStore.setActive` called.
    - Click manage button → `EnvironmentPanel` rendered (mock it with `vi.mock`).
  - [x] `dispatch/src/components/Layout/AppShell.test.tsx` (extend or new):
    - Mock `@/lib/environments` (`loadAllEnvironments`) and `@/stores/environmentStore`.
    - On render, `loadAllEnvironments` called and `useEnvironmentStore.getState().loadAll` called with result.

- [x] Task 7 - Quality gates
  - [x] Run `yarn test` from `dispatch/` — all tests pass.
  - [x] Run `yarn typecheck` from `dispatch/` — no TypeScript errors.
  - [x] Run `yarn tauri dev` — smoke test: create environment, add variables, switch active environment from selector, delete environment.

- [x] Final Task - Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 3.1.

## Dev Notes

### Story Foundation

Story 3.1 is the first story in Epic 3 (Environments & Auth). **The DB schema for environments already exists** in `001_initial.sql` and the `Environment` interface is already fully defined in `db.ts`. No new migration is required.

Two stubs were pre-created but are empty:
- `dispatch/src/stores/environmentStore.ts` — **completely empty**, write it fresh following `historyStore.ts`
- `dispatch/src/components/EnvironmentPanel/` — contains only `.gitkeep`, safe to add new files

**Do NOT** implement variable interpolation (Story 3.2) or auth types (Story 3.3) in this story.  
**Do NOT** implement import/export of environments — deferred to Story 4.2 per the epic spec.

### Critical: SQLite `is_active` is INTEGER (0/1), not boolean

`tauri-plugin-sql` returns SQLite `INTEGER` columns as JavaScript `number`. Always deserialize:
```typescript
is_active: row.is_active === 1,
```
The `Environment` interface in `db.ts` correctly types `is_active: boolean` — the mismatch only exists at the raw DB layer.

### Critical: `variables` is JSON TEXT

Like `headers`/`query_params` in `collections.ts`, the `variables` column stores a JSON array string:
- **Read**: `JSON.parse(row.variables) as KeyValuePair[]`
- **Write**: `JSON.stringify(variables)` in the SQL parameter

`KeyValuePair` shape: `{ key: string; value: string; enabled: boolean }` — already defined in `db.ts`, do not redefine.

### Critical: `setActiveEnvironment` — Two-Step SQL

Only one environment should be active at a time. The correct pattern:
```typescript
export async function setActiveEnvironment(id: string | null): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE environments SET is_active = 0');
  if (id !== null) {
    await db.execute('UPDATE environments SET is_active = 1 WHERE id = ?', [id]);
  }
}
```
Do **not** use `WHERE id != ?` — that misses rows if the DB state is inconsistent.

### Existing Infrastructure — Do Not Reinvent

| Asset | Location | Status |
|---|---|---|
| `Environment` interface | `@/lib/db` | Complete — use as-is |
| `KeyValuePair` interface | `@/lib/db` | Shared with `headers`, `query_params`, `variables` |
| `getDb()` | `@/lib/db` | DB singleton — all DB ops go through this |
| `environmentStore.ts` stub | `@/stores/environmentStore.ts` | Empty file — fill from scratch |
| `EnvironmentPanel/` dir | `@/components/EnvironmentPanel/` | Only `.gitkeep` — add files freely |
| `TopBar.tsx` | `@/components/TopBar/TopBar.tsx` | Currently minimal (name only) — extend it |
| `AppShell.tsx` | `@/components/Layout/AppShell.tsx` | Add startup `useEffect` here |

### Architecture Compliance

- All imports must use alias `@/...` — never relative `../../` paths.
- Stores use Zustand + Immer (`create<State>()(immer((set) => ({...})))`) — `environmentStore` should follow `historyStore.ts` exactly as a model.
- All environment DB helpers live in `dispatch/src/lib/environments.ts` (new, analogous to `collections.ts` and `history.ts`).
- `crypto.randomUUID()` is available in Tauri WebView (Chromium) — use it for new environment IDs.
- Define a local `const now = () => new Date().toISOString()` at the top of `environments.ts` (not exported from `collections.ts`).

### File Structure Requirements

**New files:**
- `dispatch/src/lib/environments.ts`
- `dispatch/src/lib/environments.test.ts`
- `dispatch/src/stores/environmentStore.test.ts`
- `dispatch/src/components/EnvironmentPanel/EnvironmentPanel.tsx`
- `dispatch/src/components/EnvironmentPanel/EnvironmentPanel.test.tsx`
- `dispatch/src/components/TopBar/TopBar.test.tsx`

**Modified files (fills empty stubs or adds to existing):**
- `dispatch/src/stores/environmentStore.ts` — empty stub, overwrite with full store impl
- `dispatch/src/components/TopBar/TopBar.tsx` — add environment selector + manage button
- `dispatch/src/components/Layout/AppShell.tsx` — add `useEffect` for startup load

**No new migration** — environments table already exists in v1.

### Testing Standards

- Runner: Vitest (`yarn test` from `dispatch/`)
- Render helper: `@testing-library/react`
- Mock `@/lib/db`:
  ```typescript
  vi.mock('@/lib/db', () => ({
    getDb: vi.fn().mockResolvedValue({ select: vi.fn(), execute: vi.fn() }),
  }));
  ```
- For store tests, reset Zustand store between tests using `useEnvironmentStore.setState(initialState)` or `beforeEach(() => store.setState({...}))`.
- See `dispatch/src/lib/history.test.ts` and `dispatch/src/stores/historyStore.test.ts` for complete mock reference patterns.

### Previous Story Intelligence (from Story 2.4 — Request History)

- `loadAll` + `useEffect([], mount)` pattern: `HistoryPanel` loads on mount, calls `historyStore.loadAll(entries)`. Use **the same approach** in `AppShell.tsx` for environments (centralized, once on startup).
- `window.confirm` for all destructive actions — no custom confirmation dialog components.
- Swallow DB errors silently in component effects: `.catch(() => {})` — consistent with `HistoryPanel`.
- List row layout patterns: `flex items-center gap-2`, `flex-1 truncate` for names.
- Table state is local `useState` within component — no store leakage for transient UI state.

### Git Intelligence (from last 5 commits)

- `feat: complete 2-4 + some ux improvements` — Story 2.4 finished; `historyStore.ts`, `HistoryPanel.tsx` patterns are the freshest reference.
- `feat: Story 2.4 - Request History` — establishes the full `loadAll` + mount pattern.
- App name in TopBar is currently "Fetch Boy 🦴" — keep it; add the environment selector to the right side.

### No Architecture Document

There is no `planning-artifacts/architecture.md` — the architecture is implicit from the codebase. Follow existing file and code patterns exactly.

### Project Structure Notes

- Tauri app entry: `dispatch/src-tauri/src/main.rs` or `lib.rs`; no Rust changes needed for this story (environments table already exists; no new Tauri commands required — all DB access goes via `tauri-plugin-sql` from the frontend JS).
- Vite aliases defined in `vite.config.ts` — `@/` maps to `dispatch/src/`.
- Tailwind config in `dispatch/tailwind.config.js` — check for existing colour tokens (e.g. `bg-app-topbar`, `text-app-inverse`, `bg-app-sidebar`) before using custom hex values.

### References

- [Epic 3 spec](_bmad-output/planning-artifacts/epic-3.md#story-31-environment-manager) — AC source
- [DB schema: environments table](dispatch/src-tauri/migrations/001_initial.sql)
- [db.ts — Environment, KeyValuePair interfaces](dispatch/src/lib/db.ts)
- [collections.ts — RawXxx + deserialize pattern](dispatch/src/lib/collections.ts)
- [history.ts — DB helper library template](dispatch/src/lib/history.ts)
- [historyStore.ts — Zustand + Immer store template](dispatch/src/stores/historyStore.ts)
- [TopBar.tsx — current state (minimal)](dispatch/src/components/TopBar/TopBar.tsx)
- [AppShell.tsx — app layout entrypoint](dispatch/src/components/Layout/AppShell.tsx)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- Implemented `dispatch/src/lib/environments.ts` with all CRUD helpers: `loadAllEnvironments`, `createEnvironment`, `renameEnvironment`, `deleteEnvironment`, `updateEnvironmentVariables`, `setActiveEnvironment`. Used two-step SQL pattern for `setActiveEnvironment` as specified.
- Implemented `dispatch/src/stores/environmentStore.ts` from scratch following the `historyStore.ts` Zustand+Immer pattern. All 6 actions implemented: `loadAll`, `addEnvironment`, `renameEnvironment`, `deleteEnvironment`, `updateVariables`, `setActive`.
- Built `EnvironmentPanel` component with two-pane layout: environment list (left) with inline rename on double-click, delete with `window.confirm`, and a variable editor (right) with key/value/enabled table and add/delete row support.
- Extended `TopBar.tsx` to include native `<select>` environment selector and ⚙ manage button that opens `EnvironmentPanel`.
- Added `useEffect` to `AppShell.tsx` to load environments from SQLite on startup.
- All 177 tests pass (18 test files), zero TypeScript errors.

### File List

- dispatch/src/lib/environments.ts (new)
- dispatch/src/lib/environments.test.ts (new)
- dispatch/src/stores/environmentStore.ts (modified — filled from empty)
- dispatch/src/stores/environmentStore.test.ts (new)
- dispatch/src/components/EnvironmentPanel/EnvironmentPanel.tsx (new)
- dispatch/src/components/EnvironmentPanel/EnvironmentPanel.test.tsx (new)
- dispatch/src/components/TopBar/TopBar.tsx (modified)
- dispatch/src/components/TopBar/TopBar.test.tsx (new)
- dispatch/src/components/Layout/AppShell.tsx (modified)
- dispatch/src/components/Layout/AppShell.test.tsx (modified)

## Change Log

- Story 3.1 implemented: Environment Manager (Date: 2026-03-10)
  - Created `environments.ts` lib with full CRUD and two-step active env SQL
  - Implemented `environmentStore.ts` (Zustand + Immer) from empty stub
  - Built `EnvironmentPanel` modal with environment list, inline rename, delete guard, and variable editor
  - Extended `TopBar` with environment selector dropdown and manage button
  - Added startup `useEffect` in `AppShell` to load environments from SQLite
  - 8 new test files across lib, store, and components; 177 tests all pass

# Story 2.2: Collections Sidebar

Status: review

## Story

As a user organizing API work in Dispatch,
I want a tree-based collections sidebar with collection/folder/request CRUD and reordering,
so that I can structure requests quickly and navigate active work without leaving the main workflow.

## Acceptance Criteria

1. Sidebar renders a tree: Collections -> Folders -> Requests.
2. Create / rename / delete for collections, folders, and saved requests.
3. Drag-and-drop reorders requests and folders within a collection.
4. Active request is highlighted in the tree.
5. Empty state shown when no collections exist.
6. All mutations persist to SQLite immediately.

Final Step: Commit all code and documentation changes for Story 2.2 before marking the story complete.

## Tasks / Subtasks

- [x] Task 1 - Implement collection tree data/state foundation (AC: 1, 4, 5)
  - [x] Implement `collectionStore` state and actions in `dispatch/src/stores/collectionStore.ts` for collections, folders, and requests hierarchy.
  - [x] Define strongly typed tree node models aligned with `Collection`, `Folder`, and `Request` contracts in `dispatch/src/lib/db.ts`.
  - [x] Add derived selectors for flattened/structured tree output and active request highlighting.

- [x] Task 2 - Add SQLite-backed CRUD operations (AC: 2, 6)
  - [x] Implement DB helpers for create/rename/delete operations for collections, folders, and requests under `dispatch/src/lib/`.
  - [x] Ensure every mutation path writes to SQLite immediately and updates store state consistently.
  - [x] Handle cascade/relationship edge cases safely (folder delete with children, request parent reassignment).

- [x] Task 3 - Build sidebar tree UI and empty state (AC: 1, 4, 5)
  - [x] Implement tree UI in `dispatch/src/components/CollectionTree/` and connect it to `Sidebar.tsx`.
  - [x] Render hierarchical structure with clear nesting and expand/collapse support where needed.
  - [x] Show active request visual state and keep existing sidebar visual language.
  - [x] Implement a clear empty state when no collections exist.

- [x] Task 4 - Implement create/rename/delete interactions (AC: 2, 6)
  - [x] Add UX for create/rename/delete actions (inline input or dialog pattern) for all three entity levels.
  - [x] Ensure interactions update both store and SQLite immediately.
  - [x] Add confirmations for destructive actions to prevent accidental data loss.

- [x] Task 5 - Add drag-and-drop reorder behavior (AC: 3, 6)
  - [x] Implement drag-and-drop for folders and requests within the same collection.
  - [x] Persist order changes to SQLite (`sort_order`) immediately after drop.
  - [x] Prevent invalid moves (cross-collection when unsupported, folder into request, etc.).

- [x] Task 6 - Add/extend tests for tree, CRUD, reorder, and persistence (AC: 1-6)
  - [x] Add store tests for tree derivation, active request highlighting logic, and reorder operations.
  - [x] Add component tests for sidebar rendering, empty state, and CRUD interactions.
  - [x] Add persistence-focused tests for DB helper calls and immediate write behavior.
  - [x] Add regression tests to ensure existing request builder/send flow remains unaffected.

- [x] Task 7 - Validate quality gates (AC: 1-6)
  - [x] Run `yarn test` from `dispatch/`.
  - [x] Run `yarn typecheck` from `dispatch/`.
  - [x] Run `yarn tauri dev` smoke check and verify sidebar interactions in runtime.

- [x] Final Task - Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 2.2.

## Dev Notes

### Story Foundation

- Epic 2 focuses on core UX; Story 2.2 establishes persistent information architecture for user requests.
- This story follows Story 2.1 and should preserve all Monaco and send-flow behavior while expanding sidebar capabilities.
- Current sidebar implementation is a minimal placeholder (`Sidebar.tsx`), and `CollectionTree/` is currently empty.

### Technical Requirements

- Keep state and rendering separation clean: store manages hierarchy + mutations; components render tree and interactions.
- Tree must support Collections -> Folders -> Requests structure with deterministic ordering.
- Active request highlight must stay in sync with request selection state and should not conflict with request editing flow.
- CRUD and reorder actions must persist immediately to SQLite to satisfy offline/local-first behavior.
- Reordering should use stable `sort_order` updates and avoid non-deterministic array mutation side effects.

### Architecture Compliance

- Align with declared project structure from spec:
  - tree UI under `src/components/CollectionTree/`
  - sidebar container remains `src/components/Sidebar/Sidebar.tsx`
  - collection logic in `src/stores/collectionStore.ts`
  - persistence logic in `src/lib/` backed by `tauri-plugin-sql`
- Maintain alias imports (`@/...`) and TypeScript strict correctness.
- Do not regress existing MainPanel, ResponseViewer, and history persistence workflows.

### Library And Framework Requirements

- Current stack: React 18 + TypeScript 5 + Zustand + Immer + Tauri SQL.
- Reuse existing dependencies first; if drag-and-drop requires a new library, choose one with React 18 support and minimal footprint.
- Keep dependency additions explicit and limited to story scope.

### File Structure Requirements

- Core files likely to change:
  - `dispatch/src/components/Sidebar/Sidebar.tsx`
  - `dispatch/src/stores/collectionStore.ts`
  - `dispatch/src/lib/db.ts`
- New files likely required:
  - `dispatch/src/components/CollectionTree/*`
  - `dispatch/src/lib/collections.ts` (or equivalent persistence service)
  - `dispatch/src/stores/collectionStore.test.ts`
  - `dispatch/src/components/CollectionTree/*.test.tsx`

### Testing Requirements

- Must cover:
  - tree rendering for nested collections/folders/requests
  - empty state behavior
  - create/rename/delete interactions at all node levels
  - reorder behavior and persistence writes
  - active request highlighting
  - regression protection for existing request builder/send features

### Previous Story Intelligence

- Story 2.1 introduced shared editor abstractions and recent MainPanel layout updates; avoid coupling sidebar logic into MainPanel.
- New UI additions in Story 2.1 used targeted component tests with deterministic mocks; follow the same test style for sidebar interactions.
- `uiSettingsStore` and other new stores were introduced as focused slices; `collectionStore` should follow similarly clear boundaries.

### Git Intelligence Summary

- Recent commits show active edits around MainPanel and settings (`38eb74b`, `a4e8917`); sidebar work should avoid unintended overlap.
- Prior story commits included `_bmad-output` and runtime files together; keep Story 2.2 file list explicit so review can isolate sidebar scope.
- `dispatch/src-tauri/migrations/001_initial.sql` already includes tables and `sort_order`; prefer using existing schema instead of migration churn for this story.

### Latest Tech Information

- For nested drag-and-drop in React, prioritize predictable state updates and keyboard accessibility support.
- SQLite-backed reorder should batch minimal writes and maintain contiguous ordering to reduce UI/store drift.
- Avoid heavyweight tree implementations if existing UI requirements can be met with simple composable components.

### Project Structure Notes

- No `project-context.md` was found in repository scope; use epic/spec and existing code as authoritative context.
- `CollectionTree/` and `HistoryPanel/` are currently placeholder/empty in `src/components/`; Story 2.2 is expected to establish this area.
- `collectionStore.ts` currently exists but is empty; implementing it is central to this story.

### References

- Story and AC source: `_bmad-output/planning-artifacts/epic-2.md`
- Product structure and collections requirements: `_bmad-output/api-client-spec.md` (Core Features 3, Project Structure, Data Models)
- Current sidebar shell: `dispatch/src/components/Sidebar/Sidebar.tsx`
- DB types and SQLite entrypoint: `dispatch/src/lib/db.ts`
- Existing schema with collections/folders/requests/sort_order: `dispatch/src-tauri/migrations/001_initial.sql`
- Prior story implementation context: `_bmad-output/implementation-artifacts/2-1-monaco-editor-integration.md`

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- `git --no-pager log --oneline -n 5`
- `git --no-pager show --name-only --pretty=format:'%h %s' -n 3`

### Completion Notes List

- Story selected from explicit user input `2-2` and resolved to `2-2-collections-sidebar`.
- Context synthesized from Epic 2 story requirements, current repository state, prior Story 2.1 learnings, and recent commit intelligence.
- Guardrails emphasize SQLite-immediate persistence, strict tree hierarchy behavior, and regression safety for existing request workflows.
- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Implementation complete** (commit `8bded00`):
  - Added `sort_order: number` to `Request` interface in `db.ts` (aligned to existing SQL schema)
  - Implemented full `collectionStore.ts` with Zustand+Immer: `TreeCollection`/`TreeFolder`/`TreeRequest` types, all CRUD actions, `getCollectionTree()` derived selector
  - Implemented `collections.ts` with all SQLite helpers: `loadAllCollections`, CRUD for collections/folders/requests, `updateFolderOrder`, `updateRequestOrder`, with JSON de/serialization
  - Built `CollectionTree.tsx`: tree hierarchy render, expand/collapse, active request highlight, inline CRUD, drag-and-drop reorder (HTML5 native DnD), empty state, `window.confirm` delete guards
  - Updated `Sidebar.tsx` to render `CollectionTree`
  - 82 tests passing: 23 store + 9 collections lib + 12 CollectionTree component + 6 AppShell + 13 MainPanel + 3 ResponseViewer + 7 db + 9 requestStore
  - All 6 Acceptance Criteria satisfied; TypeScript clean

### File List

- Added: `_bmad-output/implementation-artifacts/2-2-collections-sidebar.md`
- Updated: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Modified: `dispatch/src/lib/db.ts` (added `sort_order` to `Request` interface)
- Modified: `dispatch/src/lib/db.test.ts` (updated `Request` fixture with `sort_order`)
- Added: `dispatch/src/lib/collections.ts` (SQLite CRUD helpers for collections/folders/requests)
- Added: `dispatch/src/lib/collections.test.ts` (9 tests for all DB helpers)
- Modified: `dispatch/src/stores/collectionStore.ts` (full Zustand+Immer store implementation)
- Added: `dispatch/src/stores/collectionStore.test.ts` (23 tests: CRUD, reorder, tree derivation)
- Added: `dispatch/src/components/CollectionTree/CollectionTree.tsx` (tree UI component with DnD)
- Added: `dispatch/src/components/CollectionTree/CollectionTree.test.tsx` (12 component tests)
- Modified: `dispatch/src/components/Sidebar/Sidebar.tsx` (wired in CollectionTree)
- Modified: `dispatch/src/components/Layout/AppShell.test.tsx` (added collections mock, async waitFor flush)
- Modified: `dispatch/src/components/MainPanel/MainPanel.tsx` (added `sort_order: 0` to requestSnapshot)

### Change Log

- 2026-03-10: Story created and moved to ready-for-dev.
- 2026-03-10: Story implemented and committed (`8bded00`). Status updated to review.
# Story 2.4: Request History

Status: ready-for-dev

## Story

As a developer using Dispatch,
I want to see an automatically-populated history of my last 200 sent requests and restore any of them with a single click,
so that I can quickly re-run or reference previous requests without manually re-entering details.

## Acceptance Criteria

1. History panel lists up to 200 entries, newest first.
2. Each entry shows: method badge, URL (truncated), status code, relative timestamp.
3. Clicking an entry restores it as the active request (with dirty-guard confirmation if unsaved changes exist).
4. "Clear History" button with confirmation wipes all history entries.
5. History panel is reachable from the sidebar toggle (Collections | History tabs at top of sidebar).

Final Step: Commit all code and documentation changes for Story 2.4 before marking the story complete.

## Tasks / Subtasks

- [ ] Task 1 - Extend `history.ts` with `loadHistory` and `clearHistory` (AC: 1, 4)
  - [ ] Define a `RawHistoryEntry` internal interface where `request_snapshot` is typed as `string` (matches what SQLite returns for a JSON TEXT column).
  - [ ] Add `loadHistory(limit = 200): Promise<HistoryEntry[]>` that runs `SELECT * FROM history ORDER BY sent_at DESC LIMIT ?` and `JSON.parse`s `request_snapshot` on each row.
  - [ ] Add `clearHistory(): Promise<void>` that runs `DELETE FROM history`.
  - [ ] Modify `persistHistoryEntry` to **return** the `HistoryEntry` it constructed (currently returns `void`). This lets `MainPanel.tsx` pass the entry directly to `historyStore.addEntry` without reconstructing it.

- [ ] Task 2 - Implement `historyStore.ts` (AC: 1, 4)
  - [ ] Use Zustand + Immer, same pattern as `collectionStore.ts` and `requestStore.ts`.
  - [ ] State: `entries: HistoryEntry[]`.
  - [ ] Actions:
    - `loadAll(entries: HistoryEntry[]): void` — replaces state (called on `HistoryPanel` mount).
    - `addEntry(entry: HistoryEntry): void` — prepends to front so newest is always first; trims to 200 entries if exceeded.
    - `clearAll(): void` — sets `entries` to `[]`.
  - [ ] Export `useHistoryStore`.

- [ ] Task 3 - Build `HistoryPanel` component (AC: 1, 2, 3, 4)
  - [ ] Create `dispatch/src/components/HistoryPanel/HistoryPanel.tsx`.
  - [ ] On mount (`useEffect` with empty deps): call `loadHistory()` then `historyStore.loadAll(entries)`. Swallow errors gracefully (non-Tauri test env).
  - [ ] Render the list from `historyStore.entries` (already sorted newest-first from store).
  - [ ] Each row renders:
    - **Method badge**: short `<span>` showing `entry.method` with a colour class (see Dev Notes for mapping). Use `font-mono text-xs font-bold uppercase`.
    - **URL**: `<span className="flex-1 truncate text-app-primary text-xs">` — truncation via CSS, no JS slicing needed.
    - **Status code**: coloured `<span>` (see Dev Notes for colour tiers). Show `"ERR"` when `status_code === 0`.
    - **Relative timestamp**: use the `formatRelativeTime` helper (see Dev Notes). Add `title={entry.sent_at}` for full ISO on hover.
  - [ ] Click on a row:
    - **Dirty guard**: if `requestStore.isDirty`, `window.confirm('You have unsaved changes. Discard and load this request?')`. If user cancels → return.
    - On proceed: `requestStore.loadFromSaved(entry.request_snapshot)`.
    - Do **not** call `collectionStore.setActiveRequest` — history entries are not saved collection requests; calling it with a history ID would corrupt active request highlighting.
  - [ ] **Clear History** button at the top of the panel (right-aligned):
    - `window.confirm('Clear all history?')`.
    - On confirm: `clearHistory()` then `historyStore.clearAll()`.
    - Wrap DB call in try/catch; show nothing on error (swallow silently, consistent with CollectionTree pattern).
  - [ ] **Empty state**: render a centred message `"No history yet. Send a request to get started."` when `entries.length === 0`.

- [ ] Task 4 - Add sidebar panel toggle to `Sidebar.tsx` (AC: 5)
  - [ ] Add local `useState<'collections' | 'history'>('collections')` to `Sidebar.tsx` (no need to persist this — collections is the natural default on every app open).
  - [ ] Render two tab buttons at the top of the sidebar: **"Collections"** and **"History"**.
    - Active tab: `bg-gray-700 text-app-inverse font-medium` (matches CollectionTree row hover style).
    - Inactive tab: `text-app-muted hover:text-app-inverse`.
    - Both: `flex-1 py-1.5 text-xs rounded cursor-pointer`.
  - [ ] Conditionally render `<CollectionTree />` or `<HistoryPanel />` below the tabs based on `activePanel` state.
  - [ ] Import `HistoryPanel` from `@/components/HistoryPanel/HistoryPanel`.

- [ ] Task 5 - Wire `historyStore.addEntry` into `MainPanel.tsx` (AC: 1)
  - [ ] Import `useHistoryStore` from `@/stores/historyStore` in `MainPanel.tsx`.
  - [ ] In `handleSendRequest`, after the successful `await persistHistoryEntry(...)` call, call `historyStore.addEntry(entry)` using the `HistoryEntry` now returned from `persistHistoryEntry`.
  - [ ] Do the same in the catch branch (where `persistHistoryEntry` is called with `statusCode: 0`).
  - [ ] This ensures the history panel updates live without requiring a panel remount.

- [ ] Task 6 - Add `formatRelativeTime` utility (AC: 2)
  - [ ] Add `formatRelativeTime(isoDate: string): string` as a named export in `dispatch/src/lib/utils.ts` (file already exists, currently has `cn` utility).
  - [ ] No new dependencies — implement with plain `Date.now()` arithmetic (see Dev Notes for reference implementation).

- [ ] Task 7 - Add/extend tests (AC: 1–5)
  - [ ] `dispatch/src/lib/history.test.ts` (new):
    - Mock `@/lib/db` (inline `vi.mock` returning a mock `getDb`).
    - Test `loadHistory`: mock DB `select` returns 3 raw rows with `request_snapshot` as JSON string; assert returned array has `request_snapshot` as parsed object; assert ORDER / LIMIT args correct.
    - Test `clearHistory`: assert `db.execute` called with `DELETE FROM history`.
    - Test `persistHistoryEntry` **returns** the `HistoryEntry` it insertes (new return-value assertion).
  - [ ] `dispatch/src/stores/historyStore.test.ts` (new):
    - Test `loadAll` sets entries.
    - Test `addEntry` prepends to front; test trim to 200 when > 200 entries.
    - Test `clearAll` empties entries.
  - [ ] `dispatch/src/components/HistoryPanel/HistoryPanel.test.tsx` (new):
    - Mock `@/lib/history`, `@/stores/historyStore`, `@/stores/requestStore`.
    - Render with empty entries → empty state text shown.
    - Render with 3 seeded entries → 3 rows visible.
    - Click row → `requestStore.loadFromSaved` called with `entry.request_snapshot`.
    - Click row when `isDirty = true` → `window.confirm` called; if cancel → `loadFromSaved` NOT called.
    - Click "Clear History" → `window.confirm` → `clearHistory` + `historyStore.clearAll` called.
  - [ ] `dispatch/src/components/Sidebar/Sidebar.test.tsx` (new, simple):
    - By default renders collection tree content (mock `CollectionTree`).
    - Click "History" tab → renders `HistoryPanel` content (mock `HistoryPanel`).
    - Click "Collections" tab → renders `CollectionTree` again.
  - [ ] `dispatch/src/lib/utils.test.ts` (new or extend if exists):
    - Test `formatRelativeTime` for: < 1 min → "just now"; 5 min → "5m ago"; 2 h → "2h ago"; 3 days → "3d ago".

- [ ] Task 8 - Quality gates
  - [ ] Run `yarn test` from `dispatch/` — all tests pass.
  - [ ] Run `yarn typecheck` from `dispatch/` — no TypeScript errors.
  - [ ] Run `yarn tauri dev` — smoke-test: send a request, open history panel, verify entry appears; click entry; verify request fields populated; clear history; verify panel empty.

- [ ] Final Task - Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 2.4.

## Dev Notes

### Story Foundation

Story 2.4 is the final story in Epic 2 (Core UX). It builds on:
- **Story 1.4**: `persistHistoryEntry` in `history.ts` and the `history` SQLite table are already in place. The `history` table schema is: `id TEXT, method TEXT, url TEXT, status_code INTEGER, response_time_ms INTEGER, request_snapshot TEXT, sent_at TEXT`.
- **Story 2.3**: `requestStore.loadFromSaved(request)` and `requestStore.isDirty` are both implemented and tested. Re-use the same dirty-guard pattern used in `CollectionTree.tsx`.
- **Story 2.2**: Sidebar toggle tabs should visually match the style of the CollectionTree header row. Use the same `bg-gray-700` for active state.

The `historyStore.ts` file already exists at `dispatch/src/stores/historyStore.ts` but is **completely empty** — implement it from scratch following the `collectionStore.ts` Zustand+Immer pattern.

### Critical: `persistHistoryEntry` Return Value Change

`history.ts` currently returns `Promise<void>`. Change the signature to `Promise<HistoryEntry>`:

```typescript
export async function persistHistoryEntry(input: PersistHistoryInput): Promise<HistoryEntry> {
    // ... existing logic ...
    const historyEntry: HistoryEntry = { ... };
    await db.execute(...);
    return historyEntry; // ADD THIS
}
```

In `MainPanel.tsx`, update both call sites:
```typescript
// success path
const entry = await persistHistoryEntry({ ... });
historyStore.addEntry(entry);

// catch path
const errorEntry = await persistHistoryEntry({ ..., statusCode: 0, responseTimeMs: 0 });
historyStore.addEntry(errorEntry);
```

### Critical: `RawHistoryEntry` for DB Deserialisation

SQLite returns `request_snapshot` as a `TEXT` (JSON string), but `HistoryEntry.request_snapshot` is typed as `Request`. Add a local raw type in `history.ts`:

```typescript
interface RawHistoryEntry {
    id: string;
    method: string;
    url: string;
    status_code: number;
    response_time_ms: number;
    request_snapshot: string; // raw JSON text from SQLite
    sent_at: string;
}

export async function loadHistory(limit = 200): Promise<HistoryEntry[]> {
    const db = await getDb();
    const rows = await db.select<RawHistoryEntry[]>(
        'SELECT * FROM history ORDER BY sent_at DESC LIMIT ?',
        [limit],
    );
    return rows.map((row) => ({
        ...row,
        request_snapshot: JSON.parse(row.request_snapshot) as Request,
    }));
}
```

### `historyStore.ts` — Full Implementation Pattern

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { HistoryEntry } from '@/lib/db';

const MAX_HISTORY = 200;

interface HistoryState {
    entries: HistoryEntry[];
    loadAll: (entries: HistoryEntry[]) => void;
    addEntry: (entry: HistoryEntry) => void;
    clearAll: () => void;
}

export const useHistoryStore = create<HistoryState>()(
    immer((set) => ({
        entries: [],
        loadAll: (entries) =>
            set((state) => {
                state.entries = entries;
            }),
        addEntry: (entry) =>
            set((state) => {
                state.entries.unshift(entry);
                if (state.entries.length > MAX_HISTORY) {
                    state.entries.length = MAX_HISTORY;
                }
            }),
        clearAll: () =>
            set((state) => {
                state.entries = [];
            }),
    })),
);
```

### `formatRelativeTime` Utility (no date-fns needed)

Add to `dispatch/src/lib/utils.ts` alongside the existing `cn` export:

```typescript
export function formatRelativeTime(isoDate: string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
```

### Method Badge Colour Mapping

Apply as Tailwind text-colour utility on the badge `<span>`:

| Method  | Class             |
| ------- | ----------------- |
| GET     | `text-blue-400`   |
| POST    | `text-green-400`  |
| PUT     | `text-orange-400` |
| PATCH   | `text-yellow-400` |
| DELETE  | `text-red-400`    |
| HEAD    | `text-gray-400`   |
| OPTIONS | `text-gray-400`   |

Implementation helper:
```typescript
function methodColour(method: string): string {
    const map: Record<string, string> = {
        GET: 'text-blue-400',
        POST: 'text-green-400',
        PUT: 'text-orange-400',
        PATCH: 'text-yellow-400',
        DELETE: 'text-red-400',
    };
    return map[method.toUpperCase()] ?? 'text-gray-400';
}
```

### Status Code Colour Mapping

| Range     | Class             |
| --------- | ----------------- |
| 2xx       | `text-green-400`  |
| 3xx       | `text-blue-400`   |
| 4xx       | `text-yellow-400` |
| 5xx       | `text-red-400`    |
| 0 (error) | `text-gray-400`   |

Implementation helper:
```typescript
function statusColour(status: number): string {
    if (status === 0) return 'text-gray-400';
    if (status < 300) return 'text-green-400';
    if (status < 400) return 'text-blue-400';
    if (status < 500) return 'text-yellow-400';
    return 'text-red-400';
}

function statusLabel(status: number): string {
    return status === 0 ? 'ERR' : String(status);
}
```

### Architecture Compliance

- Follow `@/...` alias imports throughout — no relative `../../` paths.
- All stores are Zustand + Immer — mutations must stay inside `immer((set) => ...)` callback. `state.entries.length = MAX_HISTORY` is valid Immer syntax to truncate an array in place.
- SQLite reads/writes go through `getDb()` from `@/lib/db`.
- All DB helpers live in their lib file (`@/lib/history.ts`) — no direct DB calls from components or stores.
- `crypto.randomUUID()` is available in the Tauri WebView (Chromium) — already used in `persistHistoryEntry`.
- CSS: use the `bg-app-*`, `text-app-*`, `border-app-*` custom-property classes from the existing palette. Do **not** hardcode hex colours.

### File Structure Requirements

**New files:**
- `dispatch/src/components/HistoryPanel/HistoryPanel.tsx`
- `dispatch/src/components/HistoryPanel/HistoryPanel.test.tsx`
- `dispatch/src/components/Sidebar/Sidebar.test.tsx`
- `dispatch/src/stores/historyStore.test.ts` (file exists and is empty — implement from scratch)
- `dispatch/src/lib/history.test.ts`

**Modified files:**
- `dispatch/src/stores/historyStore.ts` (currently empty — full implementation)
- `dispatch/src/lib/history.ts` (add `loadHistory`, `clearHistory`; change `persistHistoryEntry` return type to `Promise<HistoryEntry>`)
- `dispatch/src/components/Sidebar/Sidebar.tsx` (add panel toggle tabs + conditional render)
- `dispatch/src/components/MainPanel/MainPanel.tsx` (use return value of `persistHistoryEntry` to call `historyStore.addEntry`)
- `dispatch/src/lib/utils.ts` (add `formatRelativeTime`)

### Library and Framework Requirements

- **Zustand 5 + Immer 10** — already installed. Use for `historyStore`.
- **lucide-react `^0.475.0`** — already installed. Use `Clock` icon in sidebar History tab (`<Clock size={14} />`), `Trash2` for Clear button, `History` for the tab label if desired.
- **No new dependencies** — `formatRelativeTime` replaces any need for `date-fns`. Everything else is already in the project.
- **React 18, TypeScript 5.7, Tauri 2, Vite 6** — unchanged.

### Sidebar Toggle Implementation Reference

```tsx
// Sidebar.tsx
import { useState } from 'react';
import { CollectionTree } from '@/components/CollectionTree/CollectionTree';
import { HistoryPanel } from '@/components/HistoryPanel/HistoryPanel';

type SidebarPanel = 'collections' | 'history';

export function Sidebar() {
  const [activePanel, setActivePanel] = useState<SidebarPanel>('collections');

  return (
    <aside data-testid="sidebar" className="bg-app-sidebar text-app-inverse overflow-y-auto p-3 flex flex-col">
      {/* Panel toggle tabs */}
      <div className="flex mb-3 rounded overflow-hidden border border-gray-700">
        <button
          type="button"
          onClick={() => setActivePanel('collections')}
          className={`flex-1 py-1.5 text-xs cursor-pointer ${
            activePanel === 'collections'
              ? 'bg-gray-700 text-app-inverse font-medium'
              : 'text-app-muted hover:text-app-inverse'
          }`}
          aria-label="Collections panel"
        >
          Collections
        </button>
        <button
          type="button"
          onClick={() => setActivePanel('history')}
          className={`flex-1 py-1.5 text-xs cursor-pointer ${
            activePanel === 'history'
              ? 'bg-gray-700 text-app-inverse font-medium'
              : 'text-app-muted hover:text-app-inverse'
          }`}
          aria-label="History panel"
        >
          History
        </button>
      </div>

      {activePanel === 'collections' ? <CollectionTree /> : <HistoryPanel />}
    </aside>
  );
}
```

### HistoryPanel Click-to-Restore: No `collectionStore.setActiveRequest`

**IMPORTANT**: Do NOT call `collectionStore.setActiveRequest(entry.id)` when restoring from history. History entry IDs are UUIDs for history records, NOT request IDs in the `requests` table. Calling `setActiveRequest` with a history ID would incorrectly highlight a non-existent or wrong item in the CollectionTree — or silently fail, but it creates confusion. Only call `requestStore.loadFromSaved(entry.request_snapshot)`.

### Testing Requirements

- **Mock pattern for `@/lib/history`**: Use inline `vi.mock('@/lib/history', () => ({ loadHistory: vi.fn(), clearHistory: vi.fn(), persistHistoryEntry: vi.fn() }))`.
- **Mock pattern for stores**: Use `vi.mock('@/stores/historyStore', ...)` and `vi.mock('@/stores/requestStore', ...)` following the same approach as `CollectionTree.test.tsx`.
- **`window.confirm` spy**: `vi.spyOn(window, 'confirm').mockReturnValue(true/false)` — same pattern as Story 2.3 tests.
- **Do not add snapshot tests** — consistent with all prior stories.
- Vitest + `@testing-library/react` — already configured in `dispatch/vitest.config.ts`.

### Previous Story Intelligence (Story 2.3)

- `requestStore.isDirty` and `requestStore.loadFromSaved(request)` are fully implemented and tested. Use them directly without modification.
- `window.confirm` is the project's standard confirmation mechanism (no custom modal). Use the same direct `window.confirm(...)` pattern.
- `collectionStore.setActiveRequest` is used by `CollectionTree` for sidebar highlighting — do NOT use it for history entries (see note above).
- Story 2.3 introduced the `SaveRequestDialog` overlay using `fixed inset-0 z-50 ...` — the `HistoryPanel` does not need an overlay, it renders inline within the sidebar.
- `@/lib/collections.ts` pattern established: raw DB interface + deserialise function + exported async helpers. Mirror this in `history.ts` for `loadHistory` using `RawHistoryEntry`.

### Git Intelligence Summary

Recent commits:
- `bf5ff56 feat: some documentation and some ux fixes` — UX tweaks post-2.3
- `9007c51 feat: Story 2.3 - Save and Load Requests` — establishes `loadFromSaved`, `isDirty`, `SaveRequestDialog`
- `8bded00 feat: Story 2.2 collections sidebar - tree UI, CRUD, DnD reorder, SQLite persistence`
- `a4e8917 feat: Story 2.1 Monaco editor integration`

Commit message pattern established: `feat: Story X.Y - <description>`. Use `feat: Story 2.4 - Request History` for the final commit.

### Project Structure Notes

- `dispatch/src/components/HistoryPanel/.gitkeep` already exists — delete it (or just create `HistoryPanel.tsx` alongside it; git will track the new file).
- `dispatch/src/stores/historyStore.ts` exists but is empty — implement directly in-place.
- `dispatch/src/lib/utils.ts` exists with only the `cn` utility — add `formatRelativeTime` as a named export.

### References

- `HistoryEntry` type and `getDb`: [dispatch/src/lib/db.ts](dispatch/src/lib/db.ts)
- `persistHistoryEntry` (to be extended): [dispatch/src/lib/history.ts](dispatch/src/lib/history.ts)
- Empty `historyStore.ts`: [dispatch/src/stores/historyStore.ts](dispatch/src/stores/historyStore.ts)
- CollectionTree dirty-guard & `loadFromSaved` pattern: [dispatch/src/components/CollectionTree/CollectionTree.tsx](dispatch/src/components/CollectionTree/CollectionTree.tsx) (`handleLoadRequest`)
- Sidebar current implementation: [dispatch/src/components/Sidebar/Sidebar.tsx](dispatch/src/components/Sidebar/Sidebar.tsx)
- AppShell grid layout: [dispatch/src/components/Layout/AppShell.tsx](dispatch/src/components/Layout/AppShell.tsx)
- `MainPanel.tsx` — `persistHistoryEntry` call sites: [dispatch/src/components/MainPanel/MainPanel.tsx](dispatch/src/components/MainPanel/MainPanel.tsx)
- CollectionStore pattern: [dispatch/src/stores/collectionStore.ts](dispatch/src/stores/collectionStore.ts)
- utils.ts (`cn`): [dispatch/src/lib/utils.ts](dispatch/src/lib/utils.ts)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

### File List

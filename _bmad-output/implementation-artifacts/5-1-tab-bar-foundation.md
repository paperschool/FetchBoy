# Story 5.1: Tab Bar Foundation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a persistent tab bar above the main request panel,
so that I can open multiple requests at once without losing my place.

## Acceptance Criteria

1. A tab bar is rendered above the request builder / response panel area.
2. A `+` button on the right of the tab bar creates a new blank tab.
3. Each tab displays a label (defaults to `New Request` until a URL is entered).
4. Tab label auto-updates to `{METHOD} {URL}` (truncated to ~30 chars) once a URL is typed; the active tab's label reflects the current `requestStore` state.
5. Hovering a tab reveals an `×` close button; clicking it removes the tab.
6. Closing the last remaining tab is blocked — at least one tab always exists.
7. Double-clicking a tab label makes it inline-editable; pressing Enter or blurring the input confirms; pressing Escape cancels and reverts.
8. Manually renamed labels are flagged (`isCustomLabel: true`) and are NOT auto-overwritten by URL changes.
9. Tab state is **session-only** — no SQLite persistence; tabs reset on app restart.
10. The active tab is visually highlighted; inactive tabs are clearly delineated.

## Tasks / Subtasks

- [ ] Task 1 — Create `tabStore` in Zustand (AC: 2, 3, 4, 6, 7, 8, 9)
  - [ ] Create `dispatch/src/stores/tabStore.ts`
  - [ ] Define `TabEntry` interface: `{ id: string; label: string; isCustomLabel: boolean }`
  - [ ] Define `TabStore` state interface and implement with `zustand` + `immer` middleware (matching pattern in `requestStore.ts`)
  - [ ] Initial state: one tab `{ id: crypto.randomUUID(), label: 'New Request', isCustomLabel: false }`, `activeTabId` = that tab's id
  - [ ] Actions: `addTab()` — appends new `TabEntry` with defaults, sets it as active
  - [ ] Actions: `closeTab(id: string)` — removes tab; blocks if only one tab remains; if closing active tab, activates the adjacent tab (prefer left neighbour, else right)
  - [ ] Actions: `setActiveTab(id: string)` — sets `activeTabId`
  - [ ] Actions: `renameTab(id: string, label: string)` — sets label and `isCustomLabel: true`
  - [ ] Actions: `syncLabelFromRequest(id: string, method: string, url: string)` — only updates label when `isCustomLabel` is `false`; produces `"{METHOD} {url}"` truncated to 30 chars (trim trailing slash, use full method)
  - [ ] Export `useTabStore` as named export

- [ ] Task 2 — Create `TabBar` component (AC: 1–10)
  - [ ] Create `dispatch/src/components/TabBar/TabBar.tsx`
  - [ ] Use `useTabStore` for all tab state
  - [ ] Subscribe to `useRequestStore((s) => ({ method: s.method, url: s.url }))` and call `syncLabelFromRequest(activeTabId, method, url)` inside a `useEffect` whenever method or url changes
  - [ ] Render a horizontal scrollable bar (`overflow-x-auto`) containing one `TabItem` per tab plus the `+` button pinned to the right
  - [ ] Each `TabItem`:
    - Renders the tab label (truncated with CSS `truncate max-w-[160px]`)
    - Shows `×` button only on hover (`group-hover:opacity-100 opacity-0`)
    - Clicking the `×` calls `closeTab(id)`; clicking the tab body calls `setActiveTab(id)`
    - When tab is active: highlighted background (Tailwind token `bg-app-main` / `bg-white dark:bg-gray-800`)
    - When tab is inactive: muted background (`bg-gray-100 dark:bg-gray-700`)
  - [ ] Double-click on a tab label replaces it with an `<input>` (controlled, auto-focused); Enter / blur → `renameTab`; Escape → cancel
  - [ ] `+` button: `onClick={() => addTab()}`, aria-label `"New tab"`

- [ ] Task 3 — Wire `TabBar` into the layout (AC: 1)
  - [ ] Open `dispatch/src/components/Layout/AppShell.tsx`
  - [ ] Import `TabBar` from `@/components/TabBar/TabBar`
  - [ ] The current grid is `grid-cols-[16rem_1fr] grid-rows-[3rem_1fr]`; change to `grid-cols-[16rem_1fr] grid-rows-[3rem_2.25rem_1fr]`
  - [ ] Add a `<div>` for the tab bar slot: `col-start-2 row-start-2` containing `<TabBar />`
  - [ ] `Sidebar` must be updated to span both content rows: add `row-span-2` (it currently auto-places into row-start-2; now it must explicitly span rows 2–3)
  - [ ] `MainPanel` must move to `row-start-3 col-start-2`
  - [ ] Verify the layout renders correctly at all three grid cells

- [ ] Task 4 — Create tests for `tabStore` (AC: 2–9)
  - [ ] Create `dispatch/src/stores/tabStore.test.ts`
  - [ ] Test: initial state has exactly one tab with label `'New Request'` and `isCustomLabel: false`
  - [ ] Test: `addTab()` appends a new tab and makes it active
  - [ ] Test: `closeTab(id)` with two tabs removes the tab and activates the neighbour
  - [ ] Test: `closeTab(id)` with one tab does nothing (tab count stays at 1)
  - [ ] Test: `renameTab(id, 'Foo')` sets label to `'Foo'` and `isCustomLabel: true`
  - [ ] Test: `syncLabelFromRequest` does NOT update label when `isCustomLabel` is `true`
  - [ ] Test: `syncLabelFromRequest` DOES update label when `isCustomLabel` is `false`
  - [ ] Test: truncation — a URL longer than 30 chars is truncated in the returned label

- [ ] Task 5 — Create tests for `TabBar` component (AC: 1–10)
  - [ ] Create `dispatch/src/components/TabBar/TabBar.test.tsx`
  - [ ] Set up test helpers: reset `tabStore` in `beforeEach` using `useTabStore.setState(initialState)`; mock `useRequestStore` to return `{ method: 'GET', url: '' }`
  - [ ] Test: renders the single default tab and `+` button
  - [ ] Test: clicking `+` button creates a second tab that becomes active
  - [ ] Test: the `×` button is accessible via hover simulation; clicking it removes tab
  - [ ] Test: attempting to close the last tab does nothing (tab count remains 1)
  - [ ] Test: double-clicking a tab label shows an `<input>`; typing `Enter` renames the tab
  - [ ] Test: pressing `Escape` during rename reverts to original label

- [ ] Task 6 — Final: commit story changes
  - [ ] Run `npx tsc --noEmit` from `dispatch/` — zero TypeScript errors
  - [ ] Run `npx vitest run` from `dispatch/` — all tests pass including new ones
  - [ ] Commit all code and documentation changes for this story with a message that includes `Story 5.1`

## Dev Notes

### Overview
Story 5.1 introduces the **visual tab bar only**. It does **not** introduce per-tab request/response state isolation — that is Story 5.2. At this stage the tab bar is a UI façade: all tabs share the single `requestStore`/**`responseStore`** singleton. The only per-tab data stored in `tabStore` is the tab's label (display string).

This intentional split keeps Story 5.1 testable and mergeable independently, and provides the visual contract against which Story 5.2's state isolation can plug in.

### tabStore Pattern
Follow the exact same Zustand + immer pattern used in `requestStore.ts`:
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useTabStore = create<TabStore>()(
  immer((set) => ({
    // …
  }))
);
```
No `persist` middleware — tabs are session-only by design.

### Auto-label Sync
The active tab's label must reflect the current request method + URL live. Wire this inside `TabBar.tsx`:
```typescript
const { method, url } = useRequestStore((s) => ({ method: s.method, url: s.url }));
const activeTabId = useTabStore((s) => s.activeTabId);
const syncLabelFromRequest = useTabStore((s) => s.syncLabelFromRequest);

useEffect(() => {
  syncLabelFromRequest(activeTabId, method, url);
}, [method, url, activeTabId, syncLabelFromRequest]);
```
`syncLabelFromRequest` must be a no-op guard when `url` is empty (keep label as `'New Request'`).

### Layout: AppShell grid change

**Before (grid-rows-[3rem_1fr]):**
| Row 1 | TopBar (col-span-2) |
| Row 2, Col 1 | Sidebar |
| Row 2, Col 2 | MainPanel |

**After (grid-rows-[3rem_2.25rem_1fr]):**
| Row 1 | TopBar (col-span-2) |
| Row 2, Col 1 | Sidebar (row-span-2) |
| Row 2, Col 2 | TabBar |
| Row 3, Col 2 | MainPanel |

CSS class changes in `AppShell.tsx`:
- Root `<div>`: `grid-rows-[3rem_1fr]` → `grid-rows-[3rem_2.25rem_1fr]`
- `<Sidebar />`: add `row-span-2` (prevents it snapping to only row 2)
- New `<div className="col-start-2 row-start-2 border-b border-app-subtle bg-app-sidebar overflow-hidden">`: wrap `<TabBar />`
- `<MainPanel />`: add `col-start-2 row-start-3` to pin it to the correct cell

### TabBar Styling Guidance
All tokens match the existing Tailwind design tokens used throughout the app:
- **Active tab**: `bg-app-main border-b-2 border-blue-500 text-app-primary`
- **Inactive tab**: `bg-app-sidebar text-app-secondary hover:bg-app-main`
- **Add button**: `text-app-secondary hover:text-app-primary hover:bg-app-main rounded px-2`
- **Close button**: `text-app-secondary hover:text-red-500 opacity-0 group-hover:opacity-100`
- Tab bar height token: `h-[2.25rem]` (matches new grid row)

### Inline Rename Pattern
Use a single `editingTabId: string | null` local state in `TabBar`:
```typescript
const [editingTabId, setEditingTabId] = useState<string | null>(null);
const [editValue, setEditValue] = useState('');
```
On double-click:
```typescript
setEditingTabId(tab.id);
setEditValue(tab.label);
```
On confirm (Enter / blur):
```typescript
renameTab(editingTabId, editValue.trim() || tab.label);
setEditingTabId(null);
```
On cancel (Escape):
```typescript
setEditingTabId(null); // don't call renameTab
```

### Close-Tab Activation Logic
When closing the active tab, prefer to activate the tab immediately to the left. If none exists (it was the first tab), activate the next one to the right:
```typescript
closeTab: (id) => set((state) => {
  if (state.tabs.length === 1) return; // blocked
  const idx = state.tabs.findIndex((t) => t.id === id);
  state.tabs.splice(idx, 1);
  if (state.activeTabId === id) {
    const newIdx = Math.max(0, idx - 1);
    state.activeTabId = state.tabs[newIdx].id;
  }
});
```

### Label Truncation
Truncation in `syncLabelFromRequest` should be JS-based (not CSS-only) so stored labels are clean:
```typescript
const raw = url ? `${method} ${url}` : 'New Request';
const label = raw.length > 30 ? raw.slice(0, 27) + '…' : raw;
```
CSS `truncate` on the label `<span>` provides additional overflow protection in narrow tabs.

### Project Structure Notes
- `tabStore.ts` → `dispatch/src/stores/tabStore.ts` (alongside other store files)
- `TabBar.tsx` → `dispatch/src/components/TabBar/TabBar.tsx` (new folder, one component)
- `TabBar.test.tsx` → `dispatch/src/components/TabBar/TabBar.test.tsx` (colocated)
- `tabStore.test.ts` → `dispatch/src/stores/tabStore.test.ts` (colocated with store)
- Only `AppShell.tsx` is modified in the Layout folder — no changes to TopBar, Sidebar, or MainPanel

### What NOT to Do
- **Do NOT** add any SQLite persistence to `tabStore` — deliberate session-only design
- **Do NOT** implement per-tab request/response state isolation here — that is Story 5.2's scope
- **Do NOT** add drag-and-drop to the tab bar — that is Story 5.4's scope
- **Do NOT** add keyboard shortcuts (`Cmd+T`, `Cmd+W`) — that is Story 5.4's scope
- **Do NOT** add a right-click context menu on tabs — that is Story 5.4's scope
- **Do NOT** change `requestStore.ts` — no modifications to existing store shape

### Regression Safety Checklist
- `AppShell` renders: `TopBar`, `Sidebar`, `TabBar` (new), `MainPanel` all visible
- `Sidebar` still shows collections, history, environments
- `MainPanel` still sends requests and displays responses
- `EnvironmentPanel` and `SettingsPanel` overlays still open correctly
- Existing `topBar.test.tsx`, `mainPanel.test.tsx`, other component tests still pass with no changes

### References
- Zustand store pattern: [dispatch/src/stores/requestStore.ts](dispatch/src/stores/requestStore.ts)
- App layout: [dispatch/src/components/Layout/AppShell.tsx](dispatch/src/components/Layout/AppShell.tsx)
- Tailwind design tokens: [dispatch/src/index.css](dispatch/src/index.css)
- Epic 5 story definitions: [Source: _bmad-output/planning-artifacts/epic-5.md#Story 5.1]
- Related next story (per-tab state isolation): [Source: _bmad-output/planning-artifacts/epic-5.md#Story 5.2]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (GitHub Copilot)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created

### File List

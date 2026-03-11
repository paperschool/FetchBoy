# Story 5.4: Tab Keyboard Shortcuts and Reordering

Status: review

## Story

As a developer,
I want to manage my tabs with keyboard shortcuts and drag-to-reorder,
so that I can navigate and organise my workspace efficiently without reaching for the mouse.

## Acceptance Criteria

1. `Cmd/Ctrl + T` opens a new blank tab and focuses it.
2. `Cmd/Ctrl + W` closes the currently active tab (blocked on last tab — shows no-op visual feedback).
3. `Cmd/Ctrl + Tab` cycles focus to the next tab (wraps around).
4. `Cmd/Ctrl + Shift + Tab` cycles focus to the previous tab (wraps around).
5. `Cmd/Ctrl + 1–9` switches directly to tab by position (1 = first, 9 = ninth or last if fewer than 9).
6. Tabs can be reordered by dragging and dropping within the tab bar; order updates in `tabStore` immediately.
7. Right-clicking a tab shows a context menu: "New Tab", "Duplicate Tab", "Close Tab", "Close Other Tabs", "Close All Tabs".
8. "Duplicate Tab" creates a new tab with a full copy of the source tab's request state (response is blank).
9. "Close All Tabs" replaces all tabs with a single fresh blank tab.
10. All keyboard shortcuts are discoverable via tooltips on the `+` button and the tab context menu.

## Tasks / Subtasks

- [x] Task 1 — Add new actions to `tabStore` (AC: 6, 7, 8, 9)
  - [x] Open `fetch-boy/src/stores/tabStore.ts`
  - [x] Add `navigateTab(direction: 'next' | 'prev'): void` — cycles `activeTabId` through `tabs` array; wraps at both ends
  - [x] Add `reorderTabs(orderedIds: string[]): void` — validates all IDs exist, then reorders `tabs` array to match `orderedIds`; `activeTabId` unchanged
  - [x] Add `duplicateTab(id: string): void` — deep-copies source tab's `requestState` via `structuredClone()`; `responseState` is a fresh `createDefaultResponseSnapshot()`; `label` = source tab's label + ` (copy)`, `isCustomLabel: true`; new tab inserted immediately after source and becomes active
  - [x] Add `closeOtherTabs(id: string): void` — removes all tabs except the one with the given id; makes that tab active
  - [x] Add `closeAllTabs(): void` — replaces all tabs with a single new `createInitialTab()`; `activeTabId` set to the new tab's id
  - [x] Update the `TabStore` interface to include all new actions

- [x] Task 2 — Install `@dnd-kit` for drag-to-reorder (AC: 6)
  - [x] From `fetch-boy/`, run: `yarn add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
  - [x] Confirm all three packages appear in `package.json` `dependencies`

- [x] Task 3 — Add drag-to-reorder to `TabBar` (AC: 6)
  - [x] Open `fetch-boy/src/components/TabBar/TabBar.tsx`
  - [x] Import `DndContext`, `PointerSensor`, `useSensor`, `useSensors`, `DragEndEvent` from `@dnd-kit/core`
  - [x] Import `SortableContext`, `horizontalListSortingStrategy`, `useSortable`, `arrayMove` from `@dnd-kit/sortable`
  - [x] Import `CSS` from `@dnd-kit/utilities`
  - [x] Configure sensor: `useSensor(PointerSensor, { activationConstraint: { distance: 5 } })` — the 5px threshold prevents accidental drag on normal clicks
  - [x] Wrap the tab list in `<DndContext sensors={sensors} onDragEnd={handleDragEnd}>` and `<SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>`
  - [x] Extract each `TabItem` into a sortable wrapper using `useSortable({ id: tab.id })`, applying `transform` style via `CSS.Transform.toString(transform)` and `transition`
  - [x] `handleDragEnd(event: DragEndEvent)`: extract `active.id` and `over?.id`; compute new order via `arrayMove(tabIds, oldIndex, newIndex)`; call `reorderTabs(newOrder)`
  - [x] Verify click, double-click, and close-button interactions are unaffected by the 5px drag threshold

- [x] Task 4 — Add right-click context menu to tab items (AC: 7, 8, 9)
  - [x] Add local state to `TabBar`: `const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)`
  - [x] Add `onContextMenu` handler on each sortable tab element: `e.preventDefault(); e.stopPropagation(); setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })`
  - [x] Render context menu `<ul role="menu">` positioned at cursor (same Tailwind classes as the app's existing context menus: `fixed z-50 min-w-[10rem] rounded-md border border-app-subtle bg-app-main py-1 shadow-lg text-sm`)
  - [x] Menu items and handler calls (dismiss menu after each):
    - "New Tab" → `addTab()`
    - "Duplicate Tab" → `duplicateTab(tabCtxMenu.tabId)`
    - "Close Tab" → `closeTab(tabCtxMenu.tabId)`
    - "Close Other Tabs" → `closeOtherTabs(tabCtxMenu.tabId)` (disable when only one tab)
    - "Close All Tabs" → `closeAllTabs()`
  - [x] Click outside dismisses the menu (propagation handled by the global `AppShell` click dismiss or a transparent overlay)

- [x] Task 5 — Create `useTabKeyboardShortcuts` hook (AC: 1–5, 10)
  - [x] Create `fetch-boy/src/hooks/useTabKeyboardShortcuts.ts`
  - [x] Hook attaches a `keydown` listener to `window` on mount (removes on unmount via cleanup)
  - [x] Guard: skip when the focused element is an `<input>`, `<textarea>`, or inside `.monaco-editor` to avoid interfering with typing:
    ```typescript
    const target = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    if (target.closest?.('.monaco-editor')) return;
    ```
  - [x] Detect modifier: `const mod = e.metaKey || e.ctrlKey`
  - [x] Shortcut bindings (only fire when `mod` is true, call `e.preventDefault()`):
    - `t` → `useTabStore.getState().addTab()`
    - `w` → `useTabStore.getState().closeTab(useTabStore.getState().activeTabId)`
    - `Tab` (no shift) → `useTabStore.getState().navigateTab('next')`
    - `Tab` (+ `e.shiftKey`) → `useTabStore.getState().navigateTab('prev')`
    - `1`–`9` (digits) → `const idx = Math.min(parseInt(e.key) - 1, tabs.length - 1); setActiveTab(tabs[idx].id)`
  - [x] Export `useTabKeyboardShortcuts` as default
  - [x] Call `useTabKeyboardShortcuts()` once inside `AppShell.tsx` (alongside the existing `useTheme()` call at the top of the component)

- [x] Task 6 — Add shortcut hints to the UI (AC: 10)
  - [x] On the `+` button in `TabBar`, update `title` attribute: `"New Tab (⌘T)"` on macOS / `"New Tab (Ctrl+T)"` on Windows/Linux
    - Detect platform: `const isMac = navigator.platform.startsWith('Mac')`
  - [x] In the context menu, append keyboard hints as muted text to the relevant items:
    - "New Tab" → ` ⌘T`
    - "Close Tab" → ` ⌘W`

- [x] Task 7 — Write unit tests (AC: 1–9)
  - [x] Update `fetch-boy/src/stores/tabStore.test.ts`
  - [x] Test: `navigateTab('next')` with two tabs advances `activeTabId` to the second tab
  - [x] Test: `navigateTab('next')` on the last tab wraps to the first tab
  - [x] Test: `navigateTab('prev')` on the first tab wraps to the last tab
  - [x] Test: `reorderTabs([id2, id1])` with two tabs swaps the order; `activeTabId` unchanged
  - [x] Test: `duplicateTab(id)` inserts a new tab immediately after source; new tab has same `requestState`; `responseState` is default; `isCustomLabel` is `true`
  - [x] Test: `duplicateTab(id)` makes the new tab active
  - [x] Test: `closeOtherTabs(id)` with three tabs leaves only the given tab
  - [x] Test: `closeAllTabs()` leaves exactly one fresh tab with label `'New Request'`
  - [x] Create `fetch-boy/src/hooks/useTabKeyboardShortcuts.test.ts`
  - [x] Test: firing `keydown` event `metaKey + 't'` on `window` triggers `addTab()`
  - [x] Test: firing `metaKey + 'w'` triggers `closeTab()` with the current `activeTabId`
  - [x] Test: firing `metaKey + 'Tab'` triggers `navigateTab('next')`
  - [x] Test: shortcut does NOT fire when `e.target` is an `<input>` (guard check)

- [x] Task 8 — Final: commit story changes
  - [x] Run `npx tsc --noEmit` from `fetch-boy/` — zero TypeScript errors
  - [x] Run `npx vitest run` from `fetch-boy/` — all tests pass including new ones
  - [x] Commit all code and documentation changes for this story with a message that includes `Story 5.4`

## Dev Notes

### Dependencies
- **Story 5.1** — TabBar component and tabStore structure required
- **Story 5.2** — `duplicateTab` deep-copies `requestState` (introduced in 5.2); `createDefaultResponseSnapshot()` required
- Implement 5.4 after both 5.1 and 5.2 are merged

### dnd-kit Installation (not in package.json yet)
```bash
cd fetch-boy && yarn add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
Use `PointerSensor` (best for Tauri WebView on both macOS and Windows). The `activationConstraint: { distance: 5 }` is critical — without it, every click on a tab triggers a drag, breaking all click interactions.

### `Cmd+W` in Tauri
In a browser, `Cmd+W` closes the tab/window. In a Tauri WebView, this is not automatically intercepted — the keyboard event reaches the app. However, test on both platforms to confirm, as Tauri's shell plugin may intercept it on some configurations.

### Monaco Editor Guard
Monaco editor captures keyboard events inside `.monaco-editor`. The guard `target.closest?.('.monaco-editor')` prevents the shortcut hook from stealing keystrokes from the editor. `?.` is required because `closest` may not exist in test environments.

### Platform Display
```typescript
const isMac = navigator.platform.startsWith('Mac');
const mod = isMac ? '⌘' : 'Ctrl';
// e.g. title={`New Tab (${mod}T)`}
```

### `structuredClone` for duplicateTab
`structuredClone()` is available in all modern browsers and Tauri WebView. It performs a true deep copy of the `RequestSnapshot` object, including nested arrays like `headers` and `queryParams`. No need for a custom deep-clone helper.

### File Locations
- `fetch-boy/src/stores/tabStore.ts` — new actions: navigateTab, reorderTabs, duplicateTab, closeOtherTabs, closeAllTabs
- `fetch-boy/src/hooks/useTabKeyboardShortcuts.ts` — new hook (new file)
- `fetch-boy/src/components/TabBar/TabBar.tsx` — dnd-kit sortable + context menu per-tab + shortcut hints
- `fetch-boy/src/components/Layout/AppShell.tsx` — call `useTabKeyboardShortcuts()`
- `fetch-boy/package.json` — add @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

### References
- [Source: fetch-boy/src/stores/tabStore.ts] — existing actions, TabEntry, createInitialTab
- [Source: fetch-boy/src/components/TabBar/TabBar.tsx] — existing TabBar structure to extend
- [Source: fetch-boy/src/components/Layout/AppShell.tsx] — existing context menu pattern + hook mount location
- [Source: _bmad-output/planning-artifacts/epic-5.md#Story 5.4]

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

### Completion Notes List

- Added store actions for navigation, reordering, duplication, close-other, and close-all tab flows with required behavior and active-tab handling.
- Implemented drag-to-reorder in `TabBar` with dnd-kit (`PointerSensor` activation distance = 5) and preserved click/double-click/close interactions.
- Added per-tab context menu with `New Tab`, `Duplicate Tab`, `Close Tab`, `Close Other Tabs`, and `Close All Tabs` actions.
- Added `useTabKeyboardShortcuts` hook and mounted it in `AppShell` to support Cmd/Ctrl shortcuts for new, close, cycle, and direct tab selection.
- Added no-op visual feedback for blocked close-on-last-tab via `tab-close-blocked` event pulse styling.
- Added shortcut discoverability hints in `+` button tooltip and tab context-menu items.
- Added/updated tests for store actions, keyboard shortcuts hook, and tab context menu/shortcut hint behavior.
- Validated with `npx tsc --noEmit` and full `npx vitest run` (all passing).

### File List

- _bmad-output/implementation-artifacts/5-4-tab-keyboard-shortcuts-and-reordering.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- fetch-boy/package.json
- fetch-boy/yarn.lock
- fetch-boy/src/components/Layout/AppShell.tsx
- fetch-boy/src/components/TabBar/TabBar.tsx
- fetch-boy/src/components/TabBar/TabBar.test.tsx
- fetch-boy/src/hooks/useTabKeyboardShortcuts.ts
- fetch-boy/src/hooks/useTabKeyboardShortcuts.test.tsx
- fetch-boy/src/stores/tabStore.ts
- fetch-boy/src/stores/tabStore.test.ts
- fetch-boy/src/components/EnvironmentPanel/EnvironmentPanel.test.tsx

## Change Log

- 2026-03-11: Implemented Story 5.4 tab keyboard shortcuts, drag reordering, and tab context menu workflows; added tests and validated typecheck/full regression suite.

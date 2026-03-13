# Story 5.3: Open Requests in New Tab

Status: complete

## Story

As a developer,
I want to open saved or history requests directly into a new tab,
so that I can compare or run variations without overwriting my current tab.

## Acceptance Criteria

1. Right-clicking a request in the collections sidebar shows a context menu with "Open in New Tab".
2. Right-clicking a request in the history panel shows a context menu with "Open in New Tab".
3. Middle-clicking (scroll-wheel click) a collection or history item opens it in a new tab.
4. Selecting "Open in New Tab" creates a new tab pre-populated with that request's full state (method, URL, headers, params, body, auth).
5. The new tab becomes the active tab immediately after opening.
6. Default left-click on a collection/history item still loads the request into the **current** tab (existing behaviour fully preserved — no regression).
7. If the current tab has unsaved changes, the existing "discard?" confirmation appears for direct left-click as before; no confirmation is needed for "Open in New Tab".
8. Tab label is set to the saved request's name (collection item) or `{METHOD} {URL}` (history item).

## Tasks / Subtasks

- [x] Task 1 — Add `openRequestInNewTab` action to `tabStore` (AC: 4, 5, 8)
  - [x] Open `src/stores/tabStore.ts`
  - [x] Add `openRequestInNewTab(snapshot: RequestSnapshot, label: string): void` action
  - [x] Action: create new `TabEntry` with the provided `requestState: snapshot`, `label`, `isCustomLabel: true`, and a fresh `createDefaultResponseSnapshot()` for `responseState`
  - [x] New tab is appended to `tabs` and becomes `activeTabId` immediately
  - [x] Export the action as part of `TabStore` interface

- [x] Task 2 — Add context menu + middle-click to `CollectionTree` request rows (AC: 1, 3, 6, 7, 8)
  - [x] Open `src/components/CollectionTree/CollectionTree.tsx`
  - [x] Add local state: `const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; requestId: string } | null>(null)`
  - [x] Add `onContextMenu` handler to each request row `<li>` (or its clickable button)
  - [x] Render context menu with "Open in New Tab" menu item
  - [x] Menu item calls `buildSnapshotFromSaved(request)` then `openRequestInNewTab`
  - [x] Dismiss the menu when clicking outside
  - [x] Add `onMouseDown` handler for middle-click (button 1)
  - [x] Left-click (`onClick`) continues to call existing `handleLoadRequest(id)` — **no change**

- [x] Task 3 — Add context menu + middle-click to `HistoryPanel` entries (AC: 2, 3, 5, 8)
  - [x] Open `src/components/HistoryPanel/HistoryPanel.tsx`
  - [x] Add local state: `const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entryId: string } | null>(null)`
  - [x] Add `onContextMenu` handler to each history row
  - [x] Menu item calls `handleOpenInNewTab(entry)` with correct label
  - [x] Add `onMouseDown` middle-click handler to each history row
  - [x] Left-click (`onClick`) continues to call existing `handleRowClick(entry)` — **no change**

- [x] Task 4 — Write unit tests (AC: 1–8)
  - [x] Update `src/stores/tabStore.test.ts`
  - [x] Test: `openRequestInNewTab(snapshot, 'My Request')` creates a new tab with `isCustomLabel: true`, label, `requestState` matching snapshot, fresh `responseState`
  - [x] Test: after `openRequestInNewTab`, `activeTabId` points to the new tab
  - [x] Test: the original tab's `requestState` is unchanged after `openRequestInNewTab`
  - [x] Update `src/components/CollectionTree/CollectionTree.test.tsx`
  - [x] Test: right-clicking a request row renders context menu with "Open in New Tab"
  - [x] Test: clicking "Open in New Tab" opens request in new tab
  - [x] Test: left-clicking does NOT open a new tab (no regression)
  - [x] Test: middle-click (button=1) opens request in a new tab
  - [x] Update `src/components/HistoryPanel/HistoryPanel.test.tsx`
  - [x] Test: right-clicking a history row shows "Open in New Tab" menu item
  - [x] Test: clicking "Open in New Tab" opens entry in new tab
  - [x] Test: left-clicking still calls the original handler (no regression)

- [x] Task 5 — Final: commit story changes
  - [x] Run `npx tsc --noEmit` from `` — zero TypeScript errors
  - [x] Run `npx vitest run` from `` — 302 tests pass (11 new), 1 pre-existing unrelated failure
  - [ ] Commit all code and documentation changes for this story with a message that includes `Story 5.3`

## Dev Notes

### Dependency on Story 5.2
`openRequestInNewTab` expects `RequestSnapshot` and `createDefaultResponseSnapshot` from Story 5.2, and calls `buildSnapshotFromSaved` from `requestSnapshotUtils.ts`. Ensure 5.2 is complete and merged before implementing this story.

### Context Menu Pattern (follow AppShell)
`AppShell.tsx` already renders a context menu — use the same Tailwind classes and `fixed z-50` positioning:
```tsx
{ctxMenu && (
  <ul
    role="menu"
    className="fixed z-50 min-w-[10rem] rounded-md border border-app-subtle bg-app-main py-1 shadow-lg text-sm"
    style={{ top: ctxMenu.y, left: ctxMenu.x }}
    onClick={(e) => e.stopPropagation()}
  >
    <li
      role="menuitem"
      className="px-3 py-1.5 hover:bg-app-subtle cursor-pointer"
      onClick={() => { handleOpenInNewTab(ctxMenu.requestId); setCtxMenu(null); }}
    >
      Open in New Tab
    </li>
  </ul>
)}
```
Stop propagation of `onClick` on the menu to prevent `AppShell`'s global click-dismiss from immediately closing it.

### Middle-Click Detection
`onAuxClick` fires for non-primary mouse buttons. Button 1 = middle click:
```tsx
onAuxClick={(e: React.MouseEvent) => {
  if (e.button === 1) {
    e.preventDefault(); // prevent browser autoscroll
    handleOpenInNewTab(request.id);
  }
}}
```
Note: `onAuxClick` may not be in older `@types/react` — if TypeScript complains, cast: `{...(e as React.MouseEvent)} onAuxClick={...}` or use `onMouseDown` with `e.button === 1` instead.

### Label for History Items
```typescript
const raw = `${entry.request_snapshot.method} ${entry.request_snapshot.url}`;
const label = raw.length > 30 ? raw.slice(0, 27) + '…' : raw;
```

### Label for Collection Items
Use `request.name` directly. `isCustomLabel: true` is set so tab renaming logic won't overwrite the saved name.

### No Dirty-State Confirmation for "Open in New Tab"
The `isDirty` check only applies when **replacing** the current tab's state. `openRequestInNewTab` always creates a NEW tab, so no confirmation is needed.

### File Locations
- `src/stores/tabStore.ts` — add `openRequestInNewTab` action + update interface
- `src/lib/requestSnapshotUtils.ts` — `buildSnapshotFromSaved` (created in Story 5.2)
- `src/components/CollectionTree/CollectionTree.tsx` — add context menu + middle-click
- `src/components/HistoryPanel/HistoryPanel.tsx` — add context menu + middle-click

### References
- [Source: src/components/Layout/AppShell.tsx] — existing context menu pattern (Tailwind classes, positioning, click-dismiss)
- [Source: src/components/CollectionTree/CollectionTree.tsx#handleLoadRequest] — existing left-click load logic
- [Source: src/components/HistoryPanel/HistoryPanel.tsx#handleRowClick] — existing row click handler
- [Source: src/stores/tabStore.ts] — addTab action as the model for openRequestInNewTab
- [Source: _bmad-output/planning-artifacts/epic-5.md#Story 5.3]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

### File List

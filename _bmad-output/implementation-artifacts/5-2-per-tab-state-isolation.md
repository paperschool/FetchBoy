# Story 5.2: Per-Tab State Isolation

Status: review

## Story

As a developer,
I want each tab to maintain its own independent request and response state,
so that switching between tabs never corrupts or overwrites work in another tab.

## Acceptance Criteria

1. Each tab owns a fully isolated copy of the entire request builder state: method, URL, headers, query params, body, auth type/config.
2. Each tab owns a fully isolated response state: status, timing, size, headers, body.
3. Switching tabs swaps the entire main panel to that tab's state instantly with no flickering.
4. A new tab initialises with a clean default request state (GET, empty URL, no headers, no body, auth: None).
5. Sending a request only affects the response pane of the originating tab.
6. No regression: all existing features (Monaco editor, collections, history, environments, auth) continue to function correctly within each tab.
7. `tabStore` is extended to hold a `requestState` and `responseState` slice per `TabEntry`.
8. `requestStore` and `responseStore` are scoped per-tab: components read the active tab's slice via selector hooks rather than a global singleton.

## Tasks / Subtasks

- [x] Task 1 — Extend `TabEntry` and `tabStore` with per-tab state slices (AC: 1, 2, 4, 7, 8)
  - [x] Open `src/stores/tabStore.ts`
  - [x] Define `RequestSnapshot` interface (data-only mirror of `RequestState` in `requestStore.ts`, no action methods): `method: HttpMethod`, `url: string`, `headers: KeyValueRow[]`, `queryParams: KeyValueRow[]`, `body: { mode: BodyMode; raw: string }`, `auth: AuthState`, `activeTab: RequestTab`, `isDirty: boolean`
  - [x] Define `ResponseSnapshot` interface: `responseData: ResponseData | null`, `requestError: string | null`, `sentUrl: string | null`, `verboseLogs: string[]`, `requestBodyLanguage: 'json' | 'html' | 'xml'`
  - [x] Add `requestState: RequestSnapshot` and `responseState: ResponseSnapshot` to `TabEntry`
  - [x] Add `createDefaultRequestSnapshot(): RequestSnapshot` factory (same defaults as `requestStore` initial state: GET, empty url, empty headers/params, body mode 'none', auth type 'none', activeTab 'headers', isDirty false)
  - [x] Add `createDefaultResponseSnapshot(): ResponseSnapshot` factory (all nulls/empty arrays, language 'json')
  - [x] Update `createInitialTab()` to include both snapshots
  - [x] Add `updateTabRequestState(id: string, patch: Partial<RequestSnapshot>): void` action — immer-patch the matching tab's `requestState`
  - [x] Add `updateTabResponseState(id: string, patch: Partial<ResponseSnapshot>): void` action — immer-patch the matching tab's `responseState`
  - [x] Update `addTab()` to initialise new tabs with default snapshots
  - [x] Export types `RequestSnapshot` and `ResponseSnapshot`

- [x] Task 2 — Create `useActiveTabState` selector hooks (AC: 3, 8)
  - [x] Create `src/hooks/useActiveTabState.ts`
  - [x] Export `useActiveRequestState()` — returns `{ state: RequestSnapshot; update: (patch: Partial<RequestSnapshot>) => void }` scoped to the active tab
  - [x] Export `useActiveResponseState()` — returns `{ state: ResponseSnapshot; update: (patch: Partial<ResponseSnapshot>) => void }` scoped to the active tab
  - [x] Both hooks subscribe to `useTabStore` and derive from `tabs.find(t => t.id === activeTabId)` to minimise re-renders

- [x] Task 3 — Migrate `MainPanel.tsx` to use per-tab state (AC: 2, 3, 5, 6)
  - [x] Open `src/components/MainPanel/MainPanel.tsx`
  - [x] Replace `useRequestStore()` reads/writes with `useActiveRequestState()`
  - [x] Replace local `useState` for `responseData`, `requestError`, `sentUrl`, `verboseLogs`, `requestBodyLanguage` with `useActiveResponseState()`
  - [x] Keep `isSending` and `saveDialogOpen` as local `useState` (UI-ephemeral, not worth persisting per-tab)
  - [x] After send completes, write response into the originating tab via `useTabStore.getState().updateTabResponseState(activeTabId, { ... })`; capture `activeTabId` in a `const` before the async send so it targets the correct tab even if the user switches tabs mid-flight
  - [x] Verify: switching tabs in dev mode shows each tab's independent request and response

- [x] Task 4 — Update non-MainPanel consumers of `requestStore` (AC: 6)
  - [x] Create `src/lib/requestSnapshotUtils.ts` exporting:
    - `buildSnapshotFromSaved(request: Request): RequestSnapshot` — converts a DB `Request` object to a `RequestSnapshot` (reuse the field-mapping logic from `requestStore.loadFromSaved`)
    - `buildSnapshotFromHistory(entry: HistoryEntry): RequestSnapshot` — same but from a `HistoryEntry.request_snapshot`
  - [x] `src/components/CollectionTree/CollectionTree.tsx`: in `handleLoadRequest`, replace `requestStore.loadFromSaved(request)` with `useTabStore.getState().updateTabRequestState(activeTabId, buildSnapshotFromSaved(request))`; keep `collectionStore.setActiveRequest(id)` unchanged
  - [x] `src/components/HistoryPanel/HistoryPanel.tsx`: in `handleRowClick`, replace `requestStore.loadFromSaved(entry.request_snapshot)` with `useTabStore.getState().updateTabRequestState(activeTabId, buildSnapshotFromSaved(entry.request_snapshot))`
  - [x] `src/components/TabBar/TabBar.tsx`: update `syncLabelFromRequest` subscription to read `method` and `url` from `useActiveRequestState().state` instead of `useRequestStore`

- [x] Task 5 — Write unit tests (AC: 1–5, 7, 8)
  - [x] Update `src/stores/tabStore.test.ts`
  - [x] Test: `addTab()` creates tab with default request state (method GET, empty url, isDirty false)
  - [x] Test: `updateTabRequestState(id, { url: 'https://example.com' })` modifies only the target tab; other tabs are unchanged
  - [x] Test: `updateTabResponseState(id, { requestError: 'timeout' })` modifies only the target tab
  - [x] Test: switching `activeTabId` does not mutate either tab's state
  - [x] Test: `useActiveRequestState()` hook's `update()` fn targets only the active tab

- [x] Task 6 — Final: commit story changes
  - [x] Run `npx tsc --noEmit` from `` — zero TypeScript errors
  - [x] Run `npx vitest run` from `` — all tests pass including new ones (1 pre-existing unrelated failure in EnvironmentPanel excluded)
  - [x] Commit all code and documentation changes for this story with a message that includes `Story 5.2`

## Dev Notes

### Design Philosophy: Extend `tabStore`, don't replace `requestStore` yet
Story 5.1 deliberately kept `tabStore` as a label-only façade. Story 5.2 now grafts per-tab state onto `tabStore`. The global `requestStore` singleton is **not deleted** — it remains as a compatibility shim so unmodified consumers continue to compile. Migration of consumers is done in Task 4; over time `requestStore` may be removed entirely.

### RequestSnapshot vs RequestState
`RequestSnapshot` is the **data-only** counterpart to `RequestState` (no action methods). It lives inside `tabStore.tabs[i].requestState`. Components call `useActiveRequestState().update(patch)` to mutate it; the hook translates that into `updateTabRequestState(activeTabId, patch)`.

### Response State migration
Currently all response fields live as local `useState` hooks in `MainPanel.tsx`:
```typescript
const [responseData, setResponseData] = useState<ResponseData | null>(null);
const [requestError, setRequestError] = useState<string | null>(null);
const [sentUrl, setSentUrl] = useState<string | null>(null);
const [verboseLogs, setVerboseLogs] = useState<string[]>([]);
const [requestBodyLanguage, setRequestBodyLanguage] = useState<'json'|'html'|'xml'>('json');
```
Moving all of these into `tabStore` is the core behavioural change of this story.

### Immer patch pattern (match existing code)
```typescript
updateTabRequestState: (id, patch) =>
  set((state) => {
    const tab = state.tabs.find((t) => t.id === id);
    if (tab) Object.assign(tab.requestState, patch);
  }),
```

### Type imports
- `ResponseData` — import from `src/components/ResponseViewer/ResponseViewer.tsx`
- `HttpMethod`, `RequestTab`, `AuthState`, `BodyMode`, `KeyValueRow` — import from `src/stores/requestStore.ts`

### No SQLite persistence
All tab state is session-only. No DB calls are introduced in this story.

### File Locations
- `src/stores/tabStore.ts` — extend with new types + actions
- `src/hooks/useActiveTabState.ts` — new selector hooks (new file)
- `src/lib/requestSnapshotUtils.ts` — new shared helper (new file)
- `src/components/MainPanel/MainPanel.tsx` — migrate state reads/writes
- `src/components/CollectionTree/CollectionTree.tsx` — update `handleLoadRequest`
- `src/components/HistoryPanel/HistoryPanel.tsx` — update `handleRowClick`
- `src/components/TabBar/TabBar.tsx` — update label sync source

### References
- [Source: src/stores/tabStore.ts] — TabEntry, existing action patterns
- [Source: src/stores/requestStore.ts] — RequestState field definitions, loadFromSaved auth mapping helper
- [Source: src/components/MainPanel/MainPanel.tsx] — current useState response fields (lines ~20–30)
- [Source: src/components/CollectionTree/CollectionTree.tsx#handleLoadRequest]
- [Source: src/components/HistoryPanel/HistoryPanel.tsx#handleRowClick]
- [Source: src/components/TabBar/TabBar.tsx] — syncLabelFromRequest usage

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

_None — implementation proceeded without blocking issues._

### Completion Notes List

- TypeScript compilation: zero errors (`npx tsc --noEmit`).
- All 291 Story-5.2-related tests pass; 1 pre-existing failure in `EnvironmentPanel.test.tsx` (unrelated to this story — confirmed by testing on main branch before changes).
- `requestStore` singleton retained as compatibility shim; per-tab state grafted onto `tabStore` via `RequestSnapshot` / `ResponseSnapshot` slices.
- `activeTabId` captured in a local `const` before each async send to guarantee response is written to the originating tab even if the user switches mid-flight.

### File List

- `src/stores/tabStore.ts` — extended with `RequestSnapshot`, `ResponseSnapshot`, `updateTabRequestState`, `updateTabResponseState`, factory helpers
- `src/stores/tabStore.test.ts` — new per-tab isolation tests added
- `src/hooks/useActiveTabState.ts` — new file: `useActiveRequestState`, `useActiveResponseState` hooks
- `src/lib/requestSnapshotUtils.ts` — new file: `buildSnapshotFromSaved`, `buildSnapshotFromHistory` helpers
- `src/components/MainPanel/MainPanel.tsx` — migrated to per-tab state hooks
- `src/components/MainPanel/MainPanel.test.tsx` — tests updated
- `src/components/CollectionTree/CollectionTree.tsx` — `handleLoadRequest` uses `updateTabRequestState`
- `src/components/CollectionTree/CollectionTree.test.tsx` — tests updated
- `src/components/HistoryPanel/HistoryPanel.tsx` — `handleRowClick` uses `updateTabRequestState`
- `src/components/HistoryPanel/HistoryPanel.test.tsx` — tests updated
- `src/components/TabBar/TabBar.tsx` — `syncLabelFromRequest` reads from `useActiveRequestState`
- `src/components/TabBar/TabBar.test.tsx` — tests updated

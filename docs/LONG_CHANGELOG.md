# Long Changelog

## [0.18.0] - 2026-03-31

### Story 15.1: Stitch Data Model, Store & Tab Shell

- SQLite migration `010_stitch.sql` creates `stitch_chains`, `stitch_nodes`, and `stitch_connections` tables with cascade deletes
- TypeScript types and raw DB row interfaces in `src/types/stitch.ts`
- DB helper functions (`loadChains`, `loadChainWithNodes`, CRUD for chains/nodes/connections) in `src/lib/stitch.ts`
- Zustand + Immer store (`useStitchStore`) with full chain/node/connection state management and SQLite persistence
- "Stitch" tab added to top-level tab bar between Intercept and Debug, rendering a placeholder canvas view with chain list sidebar
- Chains load from SQLite on StitchView mount

## [0.17.7] - 2026-03-31

- feat: small tweaks and visual improvements to splash screen.

## [0.17.6] - 2026-03-30

### Improvements

- Breakpoint editor: contextual match type descriptions below the selector buttons; debounced history match counter invokes Rust `match_breakpoint_url` against intercepted requests
- Urgency progress bar fixed — `!editMode` guard removed so the bar appears during pauses; bar now fills left-to-right with a thicker 6px track
- "Add Breakpoint" button conditionally hidden in `RequestDetailView` when `pauseState !== 'idle'`; paused container uses `rounded` + `overflow-hidden` instead of `rounded-lg`
  - Files changed: `BreakpointEditor.tsx`, `PausedRequestDetail.tsx`, `RequestDetailView.tsx`, `InterceptView.tsx`
  - Breaking changes: no

## [0.17.5] - 2026-03-30

### Improvements

- GitHub release version check via `fetchLatestRelease()` in `appVersion.ts` — semver comparison drives button state in GeneralSettings (idle/checking/up-to-date/available/error) and update banner in WhatsNewModal
- Auth fields (`token`, `username`, `password`, `key`, `value`) now interpolated through `applyEnv()` in `useSendRequest.ts` before being sent to Rust, fixing 401s when credentials use `{{variable}}` placeholders
- Debug events emitted from `useSendRequest.ts` at every stage of the fetch lifecycle (send, resolve, pre-request script, response, cancel, timeout, error) with source `"fetch"`
- Breakpoints and mappings tree headers (`BreakpointsTree.tsx`, `MappingsTree.tsx`) restyled to match collection tree — green Create icons, import section commented out with TODO
- `Collection-Generation-Prompt.md` updated: asks for API reference before generating, documents `secret` field, protocol auto-prepend behaviour, and environment round-tripping
  - Files changed: `appVersion.ts`, `GeneralSettings.tsx`, `WhatsNewModal.tsx`, `useSendRequest.ts`, `BreakpointsTree.tsx`, `MappingsTree.tsx`, `ImportWizard.tsx`, `Collection-Generation-Prompt.md`
  - Breaking changes: no

## [0.17.2] - 2026-03-28

### Epic 15: Pre-request Scripts

- QuickJS WASM sandbox executes JavaScript before each request with `fb.env`, `fb.request`, and `fb.utils` API (uuid, timestamps, base64, sha256, hmacSha256)
- New "Scripts" tab in Request Details with Monaco JS editor, enable/disable toggle, and inline API cheatsheet
- Postman v2.1/v1 importers now extract pre-request scripts; FetchBoy export/import round-trips script fields
- DB migration `009`: `pre_request_script` and `pre_request_script_enabled` columns on requests

## [0.17.0] - 2026-03-27

### Epic 14: Bug Fixes, UX Refinements & Collection Import

- Hardened proxy shutdown with port-release verification, "Stopping..." UI state, and fixed disabled breakpoints/mappings not syncing to backend
- Import wizard for Postman (v1, v2.0, v2.1) and Insomnia (v4) collections with environment extraction, collection-environment binding, and version-specific format selection
- Environment variable validation indicators (green/red ring) on header and query param inputs, plus clickable quick-add for unresolved `{{variables}}` from the URL bar
- "Open in Fetch" info banner in Request Details, cursor-pointer audit across intercept sidebar, and reorganised collection header actions
- DB migration: `default_environment_id` on collections — auto-switches environment when loading requests from a bound collection

## [0.16.0] - 2026-03-27

### Epic 13: Code Quality & Architecture Remediation

- Split proxy, MainPanel, RequestDetailView, InterceptSidebar, and CollectionTreeState into modular files; unified breakpoints/mappings DB layer and store CRUD patterns
- Created shared utilities (`arrayHelpers`, `constants`, `useTauriListener`, `validators`, `dbHelpers`) reducing duplication across stores and hooks
- Type safety hardening: type guards replacing unsafe `as` casts, strict null checks in `useActiveTabState` and `requestSnapshotUtils`
- Error boundaries wrapping all major panels, toast notification system, and SQLite transaction helper (`withTransaction`)
- Removed legacy dual event emission from proxy handler; virtualised debug tables for performance

## [0.15.12] - 2026-03-27

### Improvements

- **Story 13.12**: TabBar selector optimization with `useShallow`; removed dead `buildSnapshotFromHistory`; added `name` field to `BreakpointRule` — pause events now show actual breakpoint names
  - Files changed: `TabBar.tsx`, `requestSnapshotUtils.ts`, `breakpoints.ts` (frontend); `types.rs`, `handler.rs` (Rust)
  - Breaking changes: no

## [0.15.11] - 2026-03-27

### Refactoring

- **Story 13.11**: Removed legacy dual event emission — deleted `InterceptEvent` struct, `EmitFn` type, and all combined event emissions from proxy handler; removed `intercept:request` listener from frontend
  - Files changed: `types.rs`, `handler.rs`, `server.rs`, `lib.rs`, `proxy_commands.rs` (Rust); `useInterceptEvents.ts` (frontend)
  - Breaking changes: no (split events were already the primary path)

## [0.15.10] - 2026-03-27

### Improvements

- **Story 13.10**: Error boundaries wrapping Fetch/Intercept/Debug/Sidebar panels; toast notification system; SQLite transaction for collection import; `withTransaction()` DB helper
  - Files changed: `ErrorBoundary.tsx`, `ToastContainer.tsx`, `toastStore.ts` (new); `dbHelpers.ts`, `importExport.ts`, `AppTabs.tsx`, `AppShell.tsx` (modified)
  - Breaking changes: no

## [0.15.9] - 2026-03-27

### Refactoring

- **Story 13.9**: Type safety hardening — created `validators.ts` with type guards; fixed non-null assertions in `useActiveTabState`; replaced unsafe `as` casts in `requestSnapshotUtils`, `AuthPanel`
  - Files changed: `validators.ts` (new); `useActiveTabState.ts`, `requestSnapshotUtils.ts`, `AuthPanel.tsx` (modified)
  - Breaking changes: no

## [0.15.8] - 2026-03-27

### Refactoring

- **Story 13.8**: Created shared utilities — `arrayHelpers.ts` (addWithMaxSize), `constants.ts` (max entries), `useTauriListener.ts` hook; updated 3 stores and reduced `useInterceptEvents` from 111→45 lines
  - Files changed: 3 new utilities; `debugStore.ts`, `mappingLogStore.ts`, `historyStore.ts`, `useInterceptEvents.ts` (modified)
  - Breaking changes: no

## [0.15.7] - 2026-03-27

### Refactoring

- **Story 13.7**: Split `useCollectionTreeState` (459 lines) into `useCollectionDragDrop`, `useCollectionInlineEdit`, `useCollectionCrud` — composition hook reduced to 84 lines
  - Files changed: `useCollectionTreeState.ts` (modified); 3 new hooks
  - Breaking changes: no

## [0.15.6] - 2026-03-27

### Refactoring

- **Story 13.6**: Unified store CRUD patterns — created `crudStoreHelpers.ts` with `saveEntity` and form→DB serializers; breakpointsStore 267→161 lines, mappingsStore 233→168 lines; added error rollback to toggle actions
  - Files changed: `crudStoreHelpers.ts` (new); `breakpointsStore.ts`, `mappingsStore.ts` (modified)
  - Breaking changes: no

## [0.15.5] - 2026-03-27

### Refactoring

- **Story 13.5**: Unified breakpoints/mappings DB layer — created `dbHelpers.ts` with `buildUpdate`, `insertOne`, `parseJsonField`, `syncToProxy`; replaced if-chain update patterns and unsafe JSON.parse casts across 5 files
  - Files changed: `dbHelpers.ts` (new); `breakpoints.ts`, `mappings.ts`, `collections.ts`, `importExport.ts` (modified)
  - Breaking changes: no

## [0.15.4] - 2026-03-27

### Refactoring

- **Story 13.4**: Refactored `RequestDetailView.tsx` (442→162) and `InterceptSidebar.tsx` (425→128); extracted shared `statusColors.ts`, `RequestDetailHeaders`, `RequestDetailBody`, `CertificateManagement`, `ProxyPortConfig` sub-components
  - Files changed: `RequestDetailView.tsx`, `InterceptSidebar.tsx`, `ResponseViewer.tsx`, `HistoryPanel.tsx` (modified); `statusColors.ts`, 4 new sub-components
  - Breaking changes: no

## [0.15.3] - 2026-03-27

### Refactoring

- **Story 13.3**: Refactored `MainPanel.tsx` from 1,019 to 219 lines — extracted `urlUtils.ts`, `useSendRequest` hook, `useProgressBar` hook, and `RequestDetailsAccordion` sub-component
  - Files changed: `MainPanel.tsx` (modified), `urlUtils.ts`, `useSendRequest.ts`, `useProgressBar.ts`, `RequestDetailsAccordion.tsx` (all new)
  - Breaking changes: no

## [0.15.2] - 2026-03-27

### Refactoring

- **Story 13.2**: Split `lib.rs` (947 lines) into 6 command modules + `platform.rs`; generic `make_emit<T>` factory replaces 5 `app_handle` clones; `lib.rs` reduced to 321 lines
  - Files changed: `src-tauri/src/lib.rs` (modified), `platform.rs`, `commands/mod.rs`, `commands/{proxy,cert,os,breakpoint,mapping,app}_commands.rs` (all new)
  - Breaking changes: no

## [0.15.1] - 2026-03-27

### Refactoring

- **Story 13.1**: Split `proxy.rs` (1,565 lines) into focused modules (`types.rs`, `url_matching.rs`, `handler.rs`, `server.rs`) with regex/wildcard pattern caching via `LazyLock<Mutex<HashMap>>`
  - Files changed: `src-tauri/src/proxy.rs` (deleted), `src-tauri/src/proxy/mod.rs`, `types.rs`, `url_matching.rs`, `handler.rs`, `server.rs` (all new)
  - Breaking changes: no

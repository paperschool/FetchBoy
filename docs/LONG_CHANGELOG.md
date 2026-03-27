# Long Changelog

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

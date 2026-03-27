# Long Changelog

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

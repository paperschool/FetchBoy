# Long Changelog

## [0.15.1] - 2026-03-27

### Refactoring

- **Story 13.1**: Split `proxy.rs` (1,565 lines) into focused modules (`types.rs`, `url_matching.rs`, `handler.rs`, `server.rs`) with regex/wildcard pattern caching via `LazyLock<Mutex<HashMap>>`
  - Files changed: `src-tauri/src/proxy.rs` (deleted), `src-tauri/src/proxy/mod.rs`, `types.rs`, `url_matching.rs`, `handler.rs`, `server.rs` (all new)
  - Breaking changes: no

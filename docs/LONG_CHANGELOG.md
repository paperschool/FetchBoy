# Long Changelog

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

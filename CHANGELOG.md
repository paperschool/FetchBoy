# Changelog

All notable changes to this project will be documented in this file.

## [0.17.7] - 2026-03-31

- feat: small tweaks and visual improvements to splash screen.

## [0.17.6] - 2026-03-30

- feat: Breakpoint editor shows contextual match type descriptions that update when switching between exact, partial, wildcard, and regex modes
- feat: Debounced "History matches" counter in breakpoint editor tests the current pattern against intercepted requests via the Rust `match_breakpoint_url` command
- fix: Urgency progress bar now visible during breakpoint pauses — removed `!editMode` guard that suppressed it; bar renders in both pause and edit mode as a left-to-right fill
- fix: "Add Breakpoint" button hidden in request detail view during active breakpoint pauses to reduce clutter
- fix: Paused request container border radius reduced from `rounded-lg` to `rounded` with `overflow-hidden` to prevent clipping outside parent bounds

## [0.17.5] - 2026-03-30

- feat: GitHub release version check — "Check for Updates" button fetches latest release and shows green/white state; WhatsNewModal displays an update banner with download link when a newer version exists
- fix: Auth environment variable interpolation — bearer tokens, basic credentials, and API keys containing `{{variables}}` are now resolved before sending, fixing 401s with environment-sourced credentials
- feat: Fetch request debug events — send initiation, URL resolution, pre-request script execution, response status/timing, cancellations, timeouts, and errors now appear in the Debug tab
- refactor: Breakpoints and mappings tree headers restyled to match fetch tab — green "Create:" icons at 14px with consistent spacing; import buttons commented out pending implementation
- feat: Collection generation prompt updated with API reference requirement, protocol handling guidance, and secret variable documentation

## [0.17.4] - 2026-03-30

- feat: Secret environment variables — new checkbox per variable that masks the value in the UI and replaces it with `<REDACTED>` on collection and environment export
- fix: Environment variable interpolation now runs before protocol detection, preventing double-protocol URLs (`https://https://...`) when `{{base_url}}` includes a scheme
- feat: Updated AI collection generation prompt with secret variable support, protocol handling guidance, and environment examples
- fix: Environment variable editor layout rebuilt with flexbox — headers now align with columns and the delete icon is no longer clipped
- fix: Key input border styling corrected in the environment variable editor

## [0.17.3] - 2026-03-30

- feat: Unified import wizard — FetchBoy native (v1), Postman, and Insomnia formats selectable from a single three-column dialog with AI-assisted collection generation prompt; removed secondary sidebar import button
- feat: Settings promoted to a top-level tab (gear icon) alongside Fetch, Intercept, and Debug
- feat: Environment round-tripping — exported `.fetchboy` files now embed the collection's default environment variables; importing recreates and links the environment automatically
- fix: SQLite WAL mode, busy timeout, and batch inserts prevent "database locked" errors during large collection imports; registered missing migration 009 for pre-request script columns
- fix: Request method badge in collection tree widened with truncation and tooltip for long method names; added `reset-db.sh` script for clean database resets

## [0.17.0] - 2026-03-27

- feat: Import wizard for Postman (v1, v2.0, v2.1) and Insomnia (v4) collections with environment extraction and collection-environment binding
- fix: Hardened proxy shutdown with port-release verification and "Stopping..." UI state; fixed disabled breakpoints/mappings not syncing to backend
- feat: Environment variable validation indicators on header and query param inputs; clickable quick-add for unresolved variables from the URL bar
- feat: "Open in Fetch" info banner in Request Details; collection-default environment auto-switches when loading requests
- fix: Cursor-pointer audit across intercept sidebar; reorganised collection header with Create/Import action groups

## [0.16.0] - 2026-03-27

- refactor: Split `proxy.rs` (1,565 lines) into four focused modules — TLS, handler, server, types — with compiled regex caching via `OnceLock`
- refactor: Split `lib.rs` (947 lines) into six command modules — proxy, certificate, settings, collection, environment, history
- refactor: Reduced `MainPanel.tsx` from 1,019 to 219 lines — extracted panel-switching logic, tab-bar actions, and sub-components into dedicated files
- refactor: Extracted shared `DetailToolbar`, `EditorSection`, and sidebar primitives from `RequestDetailView` and `InterceptSidebar`, eliminating cross-component duplication
- refactor: Unified breakpoints/mappings DB layer with a generic update builder and shared SQL helpers
- refactor: Consolidated store CRUD patterns across `breakpointsStore` and `mappingsStore` with shared action factories
- refactor: Split `useCollectionTreeState` (458 → 84 lines) into focused hooks — drag-and-drop, inline rename, tree expansion
- feat: Shared utility modules — status colour map, array trimmer, typed Tauri invoke wrapper, event listener factory, and centralised constants
- feat: Type safety hardening — Zod runtime validation on Tauri event payloads, branded ID types, strict non-null fixes across stores
- feat: Error boundaries around every major panel, SQLite transaction wrappers for multi-step DB writes, and a toast notification system for surfacing async failures
- refactor: Removed legacy dual event emission (`InterceptEvent`, `EmitFn`, combined `intercept:request` listener) from the Rust proxy — split events are now the sole path
- chore: Smaller component fixes — `SettingsPanel`, `AuthPanel`, `HistoryPanel`, and `TourController` brought under the 150-line limit; dead code removed

## [0.15.0] - 2026-03-26

- feat: Debug tab with dual log view — internal Rust events and MITM traffic displayed stacked vertically with search, clear, and auto-scroll
- feat: Proxy flow diagram — visual pipeline (Incoming → TLS → Breakpoint → Mapping → Upstream → Response → Client) with real-time flash animation and per-stage counters
- feat: OS proxy & certificate settings shortcuts — "Proxy Settings" and "Cert Manager" buttons open native OS configuration panels (macOS, Windows, Linux)
- feat: Debug log file persistence — all internal events and traffic summaries written to daily-rotated log files with 7-day auto-cleanup; "Open Log Folder" button in Debug tab
- feat: Breakpoint interaction countdown — 5-second amber progress bar during paused requests as a visual nudge
- feat: Breakpoint editor simplified — removed pre-configured response override tab (now covered by Mappings); inline live editing during pauses remains
- fix: Breakpoint and mapping editors now correctly refresh when switching between items

## [0.14.1] - 2026-03-26

- fix: Breakpoints / Mapping edit views change when selecting different breakpoints

## [0.14.0] - 2026-03-25

- feat: Request mapping system — URL-pattern rules with header add/remove, cookie editing, response body override (Monaco editor + file mode), and URL rewriting applied by the Rust proxy
- feat: Mappings sidebar tab with folder structure, click-to-edit rows, and mapping editor with inline folder creation
- feat: Mapping activity log sub-tab in intercept view showing which rules fired per request
- feat: Map button, overrides tab, and window title now displays app version
- feat: Image content types added to response body editor

## [0.13.0] - 2026-03-24

- feat: Split request/response events — intercepted requests now appear in the table immediately with a pulsing "Pending" badge before the upstream response arrives
- feat: Response data updates in-place when it arrives (status code, size, content-type fill in)
- feat: Detail view shows request headers/body/params for pending requests; body tab shows "Awaiting response..." placeholder
- feat: New Tauri events `intercept:request-split` and `intercept:response-split` emitted by the Rust proxy alongside the existing combined event
- fix: Akamai and CDN/WAF errors caused by missing Accept-Encoding header — proxy now sets `Accept-Encoding: identity` instead of removing the header

## [0.12.0] - 2026-03-24

- feat: Certificate uninstall now performs full cleanup — stops the proxy server, unconfigures OS proxy settings, and deletes CA files from disk
- feat: Start Proxy button is greyed out when the CA certificate is not installed; clicking it opens the settings panel and shows a tutorial tooltip prompting certificate installation
- feat: New `delete_ca_files` Tauri command for removing CA key material from the app data directory
- feat: `caInstalled` state lifted to global Zustand store so proxy controls and sidebar stay in sync

## [0.11.1] - 2026-03-13

- feat: Unified tab bar — top bar removed, tab labels carry icons, and per-tab actions (environments, proxy toggle) move to the right of the tab strip
- feat: Native OS menu bar with Edit shortcuts and Help > Restart Tutorial wired to the tour system
- feat: Image viewer (zoom/pan) now available in the intercept request detail panel
- fix: Breakpoint wildcard URL patterns now prepend `*` automatically when no protocol is present; derived patterns always include `https://`
- fix: Intercept table empty-row flicker and update jitter resolved via `useDeferredValue` and a stale-index guard
- fix: Rust compiler warnings cleared — unused imports, dead code, and camelCase field names resolved

## [0.11.0] - 2026-03-13

- feat: Breakpoint intercept viewer opens in inline edit mode by default when a breakpoint is hit
- feat: Inline response editing — status code, content-type, body (Monaco), response headers, and query params all editable in place; amber ring styles the entire detail viewer area during a pause
- feat: "Continue with Edits" replaces modal dialog; "Add Breakpoint" button added to request detail header
- feat: Play/pause toggle on each breakpoint row in the sidebar for quick enable/disable
- feat: Enable/disable toggle in breakpoint editor restyled as a pill button (matches proxy Start/Stop style); stays in sync with sidebar toggle
- feat: Proxy Start/Stop button restyled as a prominent colored pill
- feat: Type and Size columns auto-hide when the intercept table is narrow
- feat: Selecting a request in the intercept table dismisses the breakpoint editor
- fix: Proxied responses with Transfer-Encoding: chunked were being cancelled by the client — strip the header and always set Content-Length when rebuilding the buffered response
- fix: Breakpoint sidebar toggle was silently failing — `get` was missing from the Zustand immer store creator signature
- fix: JSON response body in edit mode now pretty-prints on entry, matching read-only view

## [0.10.0] - 2026-03-13

- Note - Changelog re-structured for clarity against stories/epics.
- feat: Breakpoints tab interface with folder structure and click-to-edit rows
- feat: Breakpoint editor with fuzzy URL matching, inline folder creation, and Monaco height
- feat: Breakpoint response mapping with Rust proxy replacement
- feat: Breakpoint status code and custom header overrides

## [0.9.0] - 2026-03-12

- feat: Top-level tab shell with Fetch and Intercept tabs
- feat: Intercept table view with search, regex filter, method and status dropdowns, and virtualised row rendering
- feat: MITM HTTPS proxy with hudsucker and a self-signed CA
- feat: Certificate and system proxy installation wizard
- feat: Event streaming bridge connecting MITM proxy to intercept table
- feat: Request detail view with Body/Headers/Params tabs
- feat: Proxy captures request headers and response body/headers
- feat: Intercept detail panel with resizable split pane between table and detail view
- feat: "Open in Fetch" button transfers method, URL, headers, query params and body
- fix: Proxy was silently dropping most requests due to shared pending state; fixed by storing pending request directly on each clone
- fix: Response bodies displayed as garbled binary; proxy strips Accept-Encoding so servers return uncompressed bodies

## [0.8.0] - 2026-03-12

- feat: Tab component abstraction and test fixes

## [0.7.0] - 2026-03-12

- feat: Splash screen startup animation
- feat: Onboarding tooltip tutorial (5-step tour extended to cover Intercept tab)
- feat: Sample "Getting Started" collection seeded on first launch
- feat: Keyboard shortcut overlay (?)
- feat: Empty state polish
- feat: What's New modal on version update (shows all versions as accordions)
- feat: Request in-flight progress bar
- feat: Request timeout configuration
- feat: Cmd/Ctrl+Enter to send requests
- feat: Settings panel in sidebar accordion

## [0.6.0] - 2026-03-11

- feat: Foldable sidebar with Cmd/Ctrl+B shortcut
- feat: Request cancellation with AbortController + Rust CancellationRegistry
- feat: Request timeout configuration
- feat: Cmd/Ctrl+Enter keyboard shortcut to send requests
- feat: Settings in sidebar accordion

## [0.5.0] - 2026-03-11

- feat: Tab bar foundation
- feat: Multi-tab UI with per-tab state isolation
- feat: Open requests in new tab

## [0.4.0] - 2026-03-11

- feat: Light/dark/system theme with persistence and Monaco integration
- feat: Import/Export collections and environments
- feat: Settings panel with theme, timeout, SSL, font-size persistence
- feat: App packaging and installers (GitHub Actions CI for macOS, Windows, Linux)
- feat: Windows build compatibility

## [0.3.0] - 2026-03-11

- feat: Environment manager with variable interpolation at send time
- feat: Auth types (Bearer, Basic, API Key, None)

## [0.2.0] - 2026-03-11

- feat: Monaco editor integration
- feat: Collections sidebar with tree UI, CRUD, drag-and-drop, SQLite persistence
- feat: Save and load requests
- feat: Request history

## [0.1.0] - 2026-03-11

- feat: Project scaffolded with Tauri v2 + React + Vite + TypeScript, Tailwind v4, and Zustand
- feat: SQLite persistence layer via tauri-plugin-sql with migrations system
- feat: Monaco editor for request/response body editing
- feat: GitHub Actions CI pipeline with bundle size checks and automated release asset uploads
- feat: Basic request builder

## [0.0.1] - 2026-03-11

- Initial release scaffolding

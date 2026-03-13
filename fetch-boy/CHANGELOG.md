# Changelog

All notable changes to this project will be documented in this file.

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

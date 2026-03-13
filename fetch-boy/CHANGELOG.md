# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-03-13

- feat: Intercept detail panel with Body / Headers / Params tabs, Monaco editor for response body, and resizable split pane between the request table and detail view
- feat: "Open in Fetch" button in both the detail view and per-row in the table — populates the fetch tab with method, URL, query params and headers from the intercepted request
- fix: Proxy was silently dropping most requests due to shared pending state across handler clones; fixed by storing pending request directly on each clone as per hudsucker's one-clone-per-request design
- fix: Response bodies displayed as garbled binary; proxy now strips Accept-Encoding so servers return uncompressed bodies; failed upstream requests now emit an error event instead of being silently dropped

## [0.2.0] - 2026-03-12

- feat: Top-level tab shell with Fetch and Intercept tabs
- feat: Intercept table view with search, regex filter, method and status dropdowns, and virtualised row rendering
- feat: MITM HTTPS proxy with hudsucker and a self-signed CA, plus a certificate and system proxy installation wizard

## [0.1.0] - 2026-03-12

- feat: Core request builder with Monaco editor, collections sidebar (CRUD, drag-and-drop, SQLite persistence), request history, environment manager with variable interpolation, and auth support (Bearer, Basic, API Key)
- feat: Multi-tab UI with per-tab state isolation, foldable sidebar (Cmd/Ctrl+B), settings panel (theme, timeout, SSL, font size) persisted to SQLite, and import/export for collections and environments
- feat: Onboarding flow — splash screen animation, 5-step tooltip tour, sample "Getting Started" collection seeded on first launch, keyboard shortcut overlay (?), and What's New modal on version update
- feat: Request cancellation (AbortController + Rust CancellationRegistry), per-tab timeout configuration, Cmd/Ctrl+Enter to send, and an in-flight progress bar

# Epic 5: Multi-Tab Workspace

**Goal:** Add a fully featured tabbed interface to the request builder so users can work on multiple requests simultaneously — creating, renaming, reordering, and closing tabs freely — while keeping all existing features fully functional and adding quick code-export utilities.

**Phase Alignment:** Phase 5 — Post-MVP Enhancement

---

## Stories

Final Step for every story: commit all code and documentation changes for that story before marking it complete.

---

### Story 5.1: Tab Bar Foundation

As a developer,
I want a persistent tab bar above the main request panel,
So that I can open multiple requests at once without losing my place.

**Acceptance Criteria:**
- A tab bar is rendered above the request builder / response panel area
- A `+` button on the right of the tab bar creates a new blank tab
- Each tab displays a label (defaults to `New Request` until a URL is entered)
- Tab label auto-updates to `{METHOD} {URL}` (truncated) once a URL is typed
- Hovering a tab reveals an `×` close button; clicking it removes the tab
- Closing the last remaining tab is blocked — at least one tab always exists
- Double-clicking a tab label makes it inline-editable; Enter or blur confirms the rename; Escape cancels
- Renamed labels persist for the lifetime of the session
- Tab state is **ephemeral (session-only)** — no SQLite persistence; tabs reset on app restart
- Active tab is visually highlighted; inactive tabs are clearly delineated

---

### Story 5.2: Per-Tab State Isolation

As a developer,
I want each tab to maintain its own independent request and response state,
So that switching between tabs never corrupts or overwrites work in another tab.

**Acceptance Criteria:**
- Each tab owns a fully isolated copy of the entire request builder state: method, URL, headers, query params, body, auth type/config
- Each tab owns a fully isolated response state: status, timing, size, headers, body
- Switching tabs swaps the entire main panel to that tab's state instantly with no flickering
- A new tab initialises with a clean default request state (GET, empty URL, no headers, no body, auth: None)
- Sending a request only affects the response pane of the originating tab
- No regression: all existing features (Monaco editor, collections, history, environments, auth) continue to function correctly within each tab
- `tabStore` is introduced in Zustand to manage the array of tabs and the active tab ID; each tab entry holds a `requestState` and `responseState` slice
- `requestStore` and `responseStore` are scoped per-tab (derived from `tabStore`)

---

### Story 5.3: Open Requests in New Tab

As a developer,
I want to open saved or history requests directly into a new tab,
So that I can compare or run variations without overwriting my current tab.

**Acceptance Criteria:**
- Right-clicking a request in the collections sidebar shows a context menu with "Open in New Tab"
- Right-clicking a request in the history panel shows a context menu with "Open in New Tab"
- Middle-clicking (scroll-wheel click) a collection or history item opens it in a new tab
- Selecting "Open in New Tab" creates a new tab pre-populated with that request's full state (method, URL, headers, params, body, auth)
- The new tab becomes the active tab immediately after opening
- Default left-click on a collection/history item still loads the request into the **current** tab (existing behaviour is fully preserved — no regression)
- If the current tab has unsaved changes, the existing "discard?" confirmation appears for direct left-click as before; no confirmation is needed for "Open in New Tab"
- Tab label is set to the saved request's name (collection item) or `{METHOD} {URL}` (history item)

---

### Story 5.4: Tab Keyboard Shortcuts and Reordering

As a developer,
I want to manage my tabs with keyboard shortcuts and drag-to-reorder,
So that I can navigate and organise my workspace efficiently without reaching for the mouse.

**Acceptance Criteria:**
- `Cmd/Ctrl + T` opens a new blank tab and focuses it
- `Cmd/Ctrl + W` closes the currently active tab (blocked on last tab — shows no-op visual feedback)
- `Cmd/Ctrl + Tab` cycles focus to the next tab (wraps around)
- `Cmd/Ctrl + Shift + Tab` cycles focus to the previous tab (wraps around)
- `Cmd/Ctrl + 1–9` switches directly to tab by position (1 = first, 9 = ninth or last if fewer than 9)
- Tabs can be reordered by dragging and dropping within the tab bar; order updates in `tabStore` immediately
- Right-clicking a tab shows a context menu: "New Tab", "Duplicate Tab", "Close Tab", "Close Other Tabs", "Close All Tabs"
- "Duplicate Tab" creates a new tab with a full copy of the source tab's request state (response is blank)
- "Close All Tabs" replaces all tabs with a single fresh blank tab
- All keyboard shortcuts are documented in a tooltip or discoverable via a keyboard shortcut overlay

---

### Story 5.5: Export Request as cURL / Code Snippet

As a developer,
I want to copy the current tab's request as a ready-to-run code snippet,
So that I can quickly reproduce or share the call without manually constructing it.

**Acceptance Criteria:**
- A "Copy as…" button (or `</>` icon) is added to the request builder toolbar, next to the Send button
- Clicking it opens a dropdown with four options: **cURL**, **Python (requests)**, **JavaScript (fetch)**, **Node.js (axios)**
- The generated snippet uses the fully-interpolated request — environment variables are resolved before rendering
- The snippet includes: method, URL, all enabled headers, all enabled query params, and the request body (where applicable)
- Auth headers/params are injected into the snippet exactly as they would be at send time (Bearer, Basic, API Key)
- Selecting an option copies the snippet to the clipboard and shows a transient "Copied!" toast confirmation
- The clipboard content is plain text; no trailing whitespace or invisible characters
- Generation is purely client-side (no Tauri command needed); the logic lives in a `generateSnippet(format, resolvedRequest)` utility function covered by unit tests
- Snippet format examples are correct and runnable (validated against known-good fixtures in unit tests)

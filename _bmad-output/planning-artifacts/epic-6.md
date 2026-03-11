# Epic 6: Workspace Ergonomics & Developer Flow

**Goal:** Improve daily developer experience by giving users fine-grained control over their workspace layout and request lifecycle — reducing friction in common workflows like toggling panels, aborting slow or stuck requests, sending via keyboard, and configuring per-request timeouts.

**Phase Alignment:** Phase 6 — Post-MVP Enhancement

---

## Stories

Final Step for every story: commit all code and documentation changes for that story before marking it complete.

---

### Story 6.1: Foldable Side Panel

As a developer,
I want to collapse and expand the left sidebar panel,
So that I can maximise the request/response workspace when I don't need the collections or history.

**Acceptance Criteria:**

- A toggle button (chevron/arrow icon) sits at the top or edge of the left panel to collapse/expand it
- `Cmd/Ctrl + B` keyboard shortcut toggles the panel open and closed
- When collapsed, the panel shrinks to a narrow icon-only strip (showing panel-type icons) rather than disappearing entirely, so it can be re-opened easily
- When expanded, the panel restores to its previous width
- The main request/response area smoothly fills the freed horizontal space on collapse and recedes on expand
- The collapsed/expanded state is persisted in app settings and restored on next launch
- The toggle is accessible by keyboard (focusable, activatable via Enter/Space)
- No regression: collections, history, and environment selector all function normally in both states

---

### Story 6.2: Request Cancellation

As a developer,
I want to cancel an in-flight HTTP request,
So that I don't have to wait for a slow or unresponsive endpoint to time out when I change my mind.

**Acceptance Criteria:**

- While a request is in-flight, the **Send** button label changes to **Cancel** and displays a loading spinner or progress indicator
- Clicking **Cancel** immediately aborts the HTTP request via `AbortController` on the frontend and a Tauri command cancellation signal on the Rust side
- The response pane transitions to a clear **"Request cancelled"** state (distinct from an error response — no red status, neutral messaging)
- Cancellation completes instantly — the UI does not freeze or wait for the network call to time out
- After cancellation, the Send button reverts to its normal state and the user can immediately send a new request
- Cancellation is scoped to the active tab — other tabs' in-flight requests are unaffected
- If the request completes before the cancel is processed, the response is shown normally (no race-condition blank state)

---

### Story 6.3: Keyboard Shortcut to Send Request

As a developer,
I want to send the current request using a keyboard shortcut,
So that I never have to reach for the mouse mid-workflow when iterating quickly.

**Acceptance Criteria:**

- `Cmd/Ctrl + Enter` triggers the Send action for the active tab from anywhere within the request builder (URL bar, headers table, body editor, params tab, auth panel)
- The shortcut does not fire if a modal, dropdown, or dialog is open
- The shortcut is documented in the keyboard shortcut overlay (introduced in Story 5.4)
- If a request is already in-flight, `Cmd/Ctrl + Enter` has no effect (does not cancel or re-send)
- No regression: Enter inside the Monaco body editor inserts a newline as normal — only `Cmd/Ctrl + Enter` sends

---

### Story 6.4: Request Timeout Configuration

As a developer,
I want to configure a timeout for individual requests,
So that runaway or unresponsive calls fail fast with a clear message rather than hanging indefinitely.

**Acceptance Criteria:**

- A **Timeout** field appears in the request builder toolbar (adjacent to the Send/Cancel button), accepting an integer value in milliseconds (default: `30000`)
- The timeout value is stored per-tab in `tabStore` alongside the rest of the request state
- A global default timeout is configurable in the Settings panel (Story 4.3); all new tabs inherit this default
- When a request exceeds the configured timeout, it is automatically cancelled and the response pane shows **"Timed out after Xs"** (neutral messaging, not an error)
- Timeout of `0` means no timeout (request runs until it completes or is manually cancelled)
- The timeout field accepts only positive integers; invalid input reverts to the previous valid value
- Timeout behaviour is implemented on the Rust/Tauri side (not relying solely on browser fetch timeout)
- Per-tab timeout value persists for the lifetime of the session (resets to global default on new tab)

---

### Story 6.5: Settings in Sidebar Accordion

As a developer,
I want to access application settings from the sidebar,
So that I can quickly configure the app without navigating to a separate settings panel.

**Acceptance Criteria:**

- A new **Settings** accordion section appears beneath the Collection/History tab interface in the sidebar
- When expanded, the accordion contains the same settings available in the current Settings panel (Story 4.3), including but not limited to:
  - Theme selection (light/dark)
  - Default timeout value
  - Import/Export options
  - Any other configurable settings
- The accordion collapses/expands smoothly with a chevron indicator
- When the sidebar is **minimised** (collapsed to icon-only strip per Story 6.1), the Settings option appears as a separate selectable icon in the collapsed strip
- Clicking the Settings icon in the minimised state opens the settings in a popover or modal, or expands the sidebar to show the Settings accordion
- The Settings state (expanded/collapsed) is persisted in app settings and restored on next launch
- No regression: All settings functionality is only found from the sidebar, the original settings panel is removed.
- The accordion is keyboard accessible (focusable, activatable via Enter/Space)

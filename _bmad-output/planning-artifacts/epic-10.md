# Epic 10: Intercept Control Features — Breakpoints & Request Editing

**Goal:** Transform the read-only Intercept view into a fully interactive HTTP inspection tool with breakpoint-based request interception, modification, and blocking capabilities.

**Phase Alignment:** Phase 10 — Intercept Control & Breakpoints

---

## Stories

Final Step for every story: commit all code and documentation changes for that story before marking it complete.

### Story 10.1: Intercept Split View with Request Table

**Goal:** Implement a horizontally split view in the Intercept tab, with a filterable request table in the top section.

**Acceptance Criteria:**
- Intercept tab uses a horizontal split (top/bottom) layout with adjustable divider
- Top section renders a table with columns: Timestamp, Method, Host + Path, Status Code, Content-Type, Size
- Table supports fuzzy search filter (searches across URL, method, status)
- Table supports regex search filter (toggle between fuzzy/regex mode)
- Table supports HTTP verb filter dropdown (GET, POST, PUT, DELETE, PATCH, etc.)
- Table supports status type filter (2xx, 3xx, 4xx, 5xx, or specific codes)
- Table has a "Clear" button to reset all filters and clear captured requests
- Selected row is highlighted in the table
- Empty state message shown when no requests match filters
- Component follows existing shadcn/ui Table patterns
- Component is ≤200 lines; filter logic extracted to utils

---

### Story 10.2: Request Detail View with Subtabs

**Goal:** Implement the bottom section of the split view that displays detailed request/response information when a table row is selected.

**Acceptance Criteria:**
- Bottom section is empty initially (no request selected)
- Clicking a table row populates the bottom section with request details
- Selected row remains highlighted in the table
- Detail view displays: Full URL, HTTP Method, Status Code, Response Size, Timestamp
- Detail view has subtabs: "Body" and "Headers"
- Body tab shows response body with syntax highlighting (JSON, XML, HTML, plain text)
- Headers tab shows request and response headers in key-value format
- Empty state placeholder shown when no request selected
- Component follows existing ResponseViewer patterns from fetch page
- Component is ≤200 lines

---

### Story 10.3: Breakpoints Tab Interface

**Goal:** Add a Breakpoints tab to the sidebar (similar to Collections/History tabs) with folder structure support.

**Acceptance Criteria:**
- Sidebar has a new "Breakpoints" tab alongside existing Collections/History tabs
- Breakpoints tab renders with folder structure (accordion style) similar to Collections
- Folders can be created, renamed, and deleted
- Breakpoints can be created within folders
- UI follows existing CollectionTree patterns
- Empty state shown when no breakpoints exist
- Tab is accessible from both Client and Intercept views
- Component is ≤150 lines

---

### Story 10.4: Breakpoint Editor with Fuzzy URL Matching

**Goal:** Implement the breakpoint editor that replaces the bottom section when creating/editing a breakpoint.

**Acceptance Criteria:**
- Selecting "New Breakpoint" or an existing breakpoint replaces the bottom split section with an editor
- Editor contains a URL input field with fuzzy matching capability
- URL input supports:
  - Exact URL matching
  - Partial URL matching (contains)
  - Wildcard patterns (e.g., `*/api/users/*`)
  - Regex patterns (toggleable)
- Save button stores the breakpoint configuration
- Cancel button discards changes and returns to detail view
- Breakpoint configuration stored: id, name, folderId, urlPattern, matchType (exact/partial/wildcard/regex), enabled
- Editor validates URL patterns before saving
- Component is ≤150 lines

---

### Story 10.5: Extended Breakpoint Actions — Response Mapping

**Goal:** Allow breakpoints to modify/override the response body before forwarding to client.

**Acceptance Criteria:**
- Breakpoint editor expands to include "Response Mapping" section
- User can enter a new response body (JSON, text, XML)
- User can select content-type for the mapped response
- When request matches breakpoint with response mapping, original response is replaced
- Mapped response is passed through to the client unchanged
- Visual indicator shows which breakpoints have response mapping enabled
- Editor validates mapped response format
- Backend support for response replacement implemented

---

### Story 10.6: Extended Breakpoint Actions — Status & Header Editing

**Goal:** Allow breakpoints to modify HTTP status codes and headers.

**Acceptance Criteria:**
- Breakpoint editor expands to include "Status Code" and "Headers" sections
- Status code dropdown/input allows selecting any HTTP status (100-599)
- Headers section allows adding, editing, removing custom headers
- When request matches breakpoint, status and headers are modified before forwarding
- Original values are logged for debugging
- Visual indicator shows which breakpoints modify status/headers
- Backend support for header/status modification implemented

---

### Story 10.7: Extended Breakpoint Actions — Request Blocking

**Goal:** Allow breakpoints to completely block matching requests.

**Acceptance Criteria:**
- Breakpoint editor includes a "Block Request" toggle
- When enabled, matching requests are blocked (not forwarded to server)
- Blocked requests return a configurable error to the client (default: 501 Not Implemented)
- User can customize the block response status and body
- Blocked requests are logged in the Intercept table with "BLOCKED" status
- Visual indicator shows which breakpoints block requests
- Backend support for request blocking implemented

---

### Story 10.8: Play Button — Continue Interrupted Request

**Goal:** Implement the play button UI that appears when a request matches a breakpoint, allowing users to continue or modify the request/response.

**Acceptance Criteria:**
- When a request matches a breakpoint that requires user action:
  - Play button appears in the sidebar (next to breakpoint)
  - Play button appears in the bottom detail section
- Play button options:
  - "Continue" - proceed with original/modified request
  - "Drop" - cancel the request entirely
  - "Edit & Continue" - open editor to modify before proceeding
- Request execution is paused at the breakpoint
- User can view full request/response details while paused
- After user action, request proceeds or is dropped
- Timeout handling if user doesn't respond (configurable, default 30s)
- UI follows existing button patterns
- Backend support for request pausing/resuming implemented

---

## Dependencies

- Story 10.1 requires: Epic 9 (Intercept Table View UI - story 9.2)
- Story 10.2 requires: Story 10.1
- Story 10.3 requires: Epic 9 (Collections sidebar patterns - story 2.2)
- Story 10.4 requires: Story 10.3
- Story 10.5 requires: Story 10.4
- Story 10.6 requires: Story 10.4
- Story 10.7 requires: Story 10.4
- Story 10.8 requires: Stories 10.4, 10.5, 10.6, 10.7

## Notes

- Breakpoint matching happens in the Rust backend for performance
- All breakpoint configurations should persist across app sessions (SQLite)
- Consider adding breakpoint import/export functionality
- Performance: Ensure intercept table handles 1000+ requests without lag
- Future consideration: WebSocket event support for real-time collaboration

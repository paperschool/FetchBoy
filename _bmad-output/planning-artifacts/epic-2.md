# Epic 2: Core UX

**Goal:** Elevate the raw prototype into a polished, usable tool — Monaco editor for rich body/response editing, a full collections sidebar with CRUD, save/load of requests, and a request history panel.

**Phase Alignment:** Phase 2 — Week 3–4

---

## Stories

Final Step for every story: commit all code and documentation changes for that story before marking it complete.

### Story 2.1: Monaco Editor Integration

**Goal:** Replace the plain textarea in the Body tab and the raw response viewer with Monaco Editor instances, with JSON auto-formatting and syntax highlighting.

**Acceptance Criteria:**
- Request body tab uses Monaco Editor in editable mode
- Response body panel uses Monaco Editor in read-only mode
- JSON responses are auto-detected and pretty-printed
- JSON, HTML, XML language modes available
- Editor respects app font-size setting
- No noticeable performance regression on large (>100KB) responses

---

### Story 2.2: Collections Sidebar

**Goal:** Implement the tree-based sidebar showing collections and nested folders with full CRUD and drag-and-drop reordering.

**Acceptance Criteria:**
- Sidebar renders a tree: Collections → Folders → Requests
- Create / rename / delete for collections, folders, and saved requests
- Drag-and-drop reorders requests and folders within a collection
- Active request is highlighted in the tree
- Empty state shown when no collections exist
- All mutations persist to SQLite immediately

---

### Story 2.3: Save and Load Requests

**Goal:** Allow users to save the current request to a collection and load any saved request by clicking it in the sidebar.

**Acceptance Criteria:**
- "Save" action opens a dialog to choose collection/folder and set a request name
- Saving a request that already exists in a collection prompts overwrite confirmation
- Clicking a request in the sidebar loads it as the active request
- Loaded request populates all tabs (method, URL, headers, params, body, auth)
- Unsaved changes prompt a "discard?" confirmation before loading another request

---

### Story 2.4: Request History

**Goal:** Show an auto-populated history of the last 200 sent requests with method, URL, status, and timestamp; allow click-to-restore and bulk-clear.

**Acceptance Criteria:**
- History panel lists up to 200 entries, newest first
- Each entry shows: method badge, URL (truncated), status code, relative timestamp
- Clicking an entry restores it as the active request
- "Clear History" button with confirmation wipes all history entries
- History panel is reachable from the sidebar toggle

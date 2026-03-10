# Epic 1: Foundation

**Goal:** Scaffold the Tauri + React application, establish the SQLite database layer, and deliver a working end-to-end request/response loop — the backbone every other feature rests on.

**Phase Alignment:** Phase 1 — Week 1–2

---

## Stories

Final Step for every story: commit all code and documentation changes for that story before marking it complete.

### Story 1.1: Project Scaffold

**Goal:** Initialise the Tauri + React + Vite + TypeScript project with Tailwind CSS, shadcn/ui, and Zustand+Immer configured and verified with a "hello world" render.

**Acceptance Criteria:**
- `yarn tauri dev` starts without errors
- React renders a placeholder shell with the top bar and sidebar regions
- Tailwind CSS utility classes apply correctly
- Zustand store can be imported and read in a component

---

### Story 1.2: SQLite Schema and Migrations

**Goal:** Define and apply the initial SQLite schema for all core entities via `tauri-plugin-sql` with a migrations system.

**Acceptance Criteria:**
- Database is created on first app launch at the platform data directory
- Tables exist: `requests`, `collections`, `folders`, `environments`, `history`
- Schema matches the data models in `api-client-spec.md`
- A migration version table tracks applied migrations
- App restarts cleanly with existing DB

---

### Story 1.3: Basic Request Builder

**Goal:** Implement the request builder UI — method selector, URL bar, and tabs for Headers, Query Params, Body (raw only), and Auth (none only) — wired to the active request Zustand store.

**Acceptance Criteria:**
- HTTP method dropdown shows: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- URL input is a full-width text field
- Headers tab: editable key-value table with enabled toggle
- Query Params tab: editable key-value table
- Body tab: plain textarea for raw input (no editor yet)
- Auth tab: shows "None" placeholder
- All fields read from and write to `requestStore`

---

### Story 1.4: Send Request via Rust

**Goal:** Wire the Send button to the `send_request` Tauri command, display the response status, timing, size, headers, and raw body in the response panel.

**Acceptance Criteria:**
- Clicking Send invokes `send_request` Tauri command with current request state
- Response panel shows: status code (coloured), response time (ms), response size
- Body tab shows raw response text
- Headers tab shows all response headers as a read-only table
- Network errors display a user-readable error message
- History entry is written to the DB on each send

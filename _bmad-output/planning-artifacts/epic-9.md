# Epic 9: TLS Proxy Intercept — MVP (Visual Only)

**Goal:** Add a minimal viable TLS traffic intercept feature to Fetch Boy. The scope is intentionally limited to a visual proof-of-concept — no request pausing, editing, or forwarding controls. The existing Client interface is unchanged and wrapped in a top-level tab shell alongside a new read-only Intercept view.

**Phase Alignment:** Phase 9 — TLS Proxy Intercept

---

## Stories

Final Step for every story: commit all code and documentation changes for that story before marking it complete.

### Story 9.1: Top-Level Tab Shell

**Goal:** Wrap the entire existing app interface in a top-level tab component so the app has two primary views: "Client" (existing app, unchanged) and "Intercept" (new, placeholder initially).

**Acceptance Criteria:**
- App root renders a top-level tab bar with two tabs: "Client" and "Intercept"
- "Client" tab renders the entire existing app interface, pixel-for-pixel unchanged
- "Intercept" tab renders a placeholder (empty state) ready for Story 9.2
- Tab component follows existing shadcn/ui `Tabs` patterns
- Tab shell component is ≤150 lines; any tab-routing logic extracted to a hook if needed
- No regressions in existing Client functionality

---

### Story 9.2: Intercept Table View UI

**Goal:** Implement the read-only Intercept table view that displays captured HTTP/HTTPS request metadata. The table is wired to a Zustand store and renders live as events arrive.

**Acceptance Criteria:**
- Intercept tab renders a table with columns: Timestamp, Method, Host + Path, Status Code, Content-Type, Size
- Table is read-only — no row actions, editing, or controls
- Table state managed in a dedicated Zustand slice (`useInterceptStore`)
- Empty state message shown when no requests have been captured
- Component is ≤150 lines; table column definitions and formatting extracted to `InterceptTable.utils.ts`
- Tailwind + shadcn/ui `Table` components used consistently with the rest of the app

---

### Story 9.3: MITM Proxy Backend

**Goal:** Spin up a local HTTP/HTTPS MITM proxy in the Rust/Tauri backend using `hudsucker` (or equivalent). The proxy generates and trusts a local CA certificate for TLS interception, and starts/stops with the app lifecycle.

**Acceptance Criteria:**
- `hudsucker` (or equivalent MITM crate) added to `src-tauri/Cargo.toml`
- A self-signed CA certificate is generated on first launch and stored in the app data directory
- The CA certificate is added to the OS trust store on first launch (macOS: security, Windows: certutil)
- A local proxy listener starts on app launch (configurable port, default `8080`) and stops on app exit
- Proxy intercepts both HTTP and HTTPS traffic
- Intercepted request metadata (timestamp, method, host, path, status code, content-type, size) is extracted
- No request pausing, modification, or forwarding controls — capture and pass-through only
- Proxy errors are logged but do not crash the app

---

### Story 9.4: Event Streaming Bridge

**Goal:** Stream intercepted request metadata from the Rust proxy backend to the frontend via Tauri events, and connect the frontend listener to update the Zustand Intercept store in real time.

**Acceptance Criteria:**
- Rust backend emits a Tauri event (`intercept:request`) for each intercepted request with a typed payload: `{ id, timestamp, method, host, path, statusCode?, contentType?, size? }`
- Frontend registers a Tauri event listener in a custom hook `useInterceptEvents`
- `useInterceptEvents` appends each received event to the `useInterceptStore` state
- Hook is called once at app startup (mounted at the tab shell level)
- Event listener is cleaned up on unmount
- Intercept table updates in real time without page reload or manual refresh
- Hook is ≤150 lines; event payload type defined in a shared `types/intercept.ts` file

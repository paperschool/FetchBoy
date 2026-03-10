# Epic 3: Environments & Auth

**Goal:** Unlock real-world API workflows by adding named environments with variable interpolation and support for the three most common auth schemes — Bearer Token, Basic Auth, and API Key.

**Phase Alignment:** Phase 3 — Week 5

---

## Stories

Final Step for every story: commit all code and documentation changes for that story before marking it complete.

### Story 3.1: Environment Manager

**Goal:** Implement the environment management UI — create, edit, and delete named environments, each containing a key-value variable store, with an active environment selector in the top bar.

**Acceptance Criteria:**
- Environment manager accessible from top bar dropdown
- Create / rename / delete environments
- Each environment has an editable key-value table (key, value, enabled toggle)
- Active environment is stored in `environmentStore` and persisted to SQLite
- Switching environments updates the active environment immediately
- Import/export environment as JSON is scoped to Story 4.2

---

### Story 3.2: Variable Interpolation

**Goal:** Interpolate `{{variable}}` references from the active environment into the URL, header values, query param values, and request body at send time.

**Acceptance Criteria:**
- `{{variable}}` tokens in URL are replaced with active environment values before send
- Same substitution applies to header values, query param values, and raw body
- Unresolved variables are highlighted visually in the URL bar (e.g. orange underline)
- Substitution is non-destructive — the stored request retains the `{{variable}}` token
- Variables with `enabled: false` are treated as undefined (not substituted)
- `useEnvironment` hook exposes `interpolate(str)` utility used by `useRequest`

---

### Story 3.3: Auth Types

**Goal:** Implement Bearer Token, Basic Auth, and API Key auth schemes in the Auth tab; generate the correct headers/query params automatically at send time.

**Acceptance Criteria:**
- Auth tab dropdown: None, Bearer Token, Basic Auth, API Key
- Bearer Token: single token field → injects `Authorization: Bearer <token>` header
- Basic Auth: username + password fields → injects base64-encoded `Authorization: Basic` header
- API Key: key name + value + location (header or query param) fields → injected accordingly
- Auth config is stored in `auth_type` + `auth_config` fields on the Request model
- Auth headers/params are injected at send time, not persisted in the headers/params tables

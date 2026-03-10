# Story 3.3: Auth Types

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer using Dispatch,
I want to configure Bearer Token, Basic Auth, or API Key authentication on the Auth tab,
so that Dispatch automatically injects the correct headers or query params when sending the request without me having to hand-craft them in the Headers/Query tabs.

## Acceptance Criteria

1. The Auth tab shows a dropdown with four options: **None**, **Bearer Token**, **Basic Auth**, **API Key**.
2. Selecting **Bearer Token** reveals a single "Token" text field; the token value is stored in `auth_config.token`.
3. Selecting **Basic Auth** reveals "Username" and "Password" fields; stored in `auth_config.username` and `auth_config.password`.
4. Selecting **API Key** reveals "Key Name", "Key Value", and a "Location" dropdown (Header / Query Param); stored in `auth_config.key`, `auth_config.value`, and `auth_config.in`.
5. Selecting **None** hides all fields; `auth_config` is empty `{}`.
6. At send time, auth credentials are **injected automatically** by the Rust backend — not persisted in the user's Headers or Query Params tables.
7. Bearer Token → Rust injects `Authorization: Bearer {token}` header.
8. Basic Auth → Rust injects `Authorization: Basic {base64(username:password)}` header (using `reqwest`'s native `.basic_auth()` method — no extra crate needed).
9. API Key (header location) → Rust injects `{keyName}: {keyValue}` header.
10. API Key (query param location) → Rust appends `{keyName}={keyValue}` to the URL query string.
11. Auth config is saved and reloaded correctly when a saved request is loaded via the Collections sidebar (round-trip via `auth_type` + `auth_config` columns already in the DB schema).
12. All 4 auth types are covered by unit tests.

Final Step: Commit all code and documentation changes for Story 3.3 before marking the story complete.

## Tasks / Subtasks

- [ ] Task 1 — Add `setAuth` action to `requestStore.ts` (AC: 1–5)
  - [ ] In `RequestState` interface, add: `setAuth: (auth: AuthState) => void`
  - [ ] Implement `setAuth` in the Zustand/Immer store body: `setAuth: (auth) => set((state) => { state.auth = auth; state.isDirty = true; })`
  - [ ] Verify `AuthState` discriminated union type (already complete — `none | bearer | basic | api-key`) — do **not** change it

- [ ] Task 2 — Create `AuthPanel` component (AC: 1–5)
  - [ ] Create `dispatch/src/components/AuthPanel/AuthPanel.tsx`
  - [ ] Accept props: `auth: AuthState` and `onAuthChange: (auth: AuthState) => void`
  - [ ] Render auth type `<select>` with options: `none` → "No Auth", `bearer` → "Bearer Token", `basic` → "Basic Auth", `api-key` → "API Key"
  - [ ] When `type === 'bearer'`: render a single labelled text input for the token, bound to `auth.token`
  - [ ] When `type === 'basic'`: render username and password inputs; password input uses `type="password"`
  - [ ] When `type === 'api-key'`: render key-name input, key-value input, and a Location select (Header / Query Param), bound to `auth.in`
  - [ ] When `type === 'none'`: render only the type dropdown with a muted helper text "No auth will be applied."
  - [ ] Each input change calls `onAuthChange({ ...auth, [field]: newValue })` — do not mutate prop
  - [ ] Changing the type dropdown calls `onAuthChange` with a completely fresh typed default: e.g., switching to bearer → `{ type: 'bearer', token: '' }`
  - [ ] Apply existing CSS class conventions (`text-app-primary`, `text-app-secondary`, `text-app-muted`, `border-app-subtle`, `bg-app-main`) — match the KeyValueRows visual style
  - [ ] Export as `AuthPanel` named export

- [ ] Task 3 — Wire `AuthPanel` into `MainPanel.tsx` auth tab (AC: 1–5, 11)
  - [ ] Import `AuthPanel` from `@/components/AuthPanel/AuthPanel`
  - [ ] Pull `setAuth` from `useRequestStore` (alongside existing destructured actions)
  - [ ] Replace the placeholder `{activeTab === 'auth' ? <p className="text-app-muted text-sm">Auth: None</p> : null}` with:
    ```tsx
    {activeTab === 'auth' ? (
      <AuthPanel auth={auth} onAuthChange={setAuth} />
    ) : null}
    ```
  - [ ] The `auth` object is already passed to `invoke()` in `handleSendRequest` — **do not change** this send path
  - [ ] The `authStateToConfig()` helper and its usage in `handleDialogSave` already handle all 4 auth types — **do not change** this logic

- [ ] Task 4 — Extend Rust `http.rs` to inject auth at send time (AC: 6–10)
  - [ ] In `RequestAuth` struct, add optional fields to capture all auth variants:
    ```rust
    #[derive(Debug, Deserialize)]
    pub struct RequestAuth {
        pub r#type: String,
        pub token: Option<String>,
        pub username: Option<String>,
        pub password: Option<String>,
        pub key: Option<String>,
        pub value: Option<String>,
        pub r#in: Option<String>,
    }
    ```
  - [ ] Add a new private function `apply_auth` that mutates the `request_builder` and (for API Key query) accepts a mutable `url`:
    ```rust
    fn apply_auth(
        mut builder: reqwest::RequestBuilder,
        auth: &RequestAuth,
        url: &mut Url,
    ) -> Result<reqwest::RequestBuilder, String> {
        match auth.r#type.as_str() {
            "none" => {}
            "bearer" => {
                let token = auth.token.as_deref().unwrap_or("");
                builder = builder.bearer_auth(token);
            }
            "basic" => {
                let username = auth.username.as_deref().unwrap_or("");
                let password = auth.password.as_deref().unwrap_or("");
                builder = builder.basic_auth(username, Some(password));
            }
            "api-key" => {
                let key = auth.key.as_deref().unwrap_or("").to_string();
                let value = auth.value.as_deref().unwrap_or("").to_string();
                match auth.r#in.as_deref().unwrap_or("header") {
                    "query" => {
                        url.query_pairs_mut().append_pair(&key, &value);
                    }
                    _ => {
                        // Default to header
                        let name = HeaderName::from_bytes(key.as_bytes())
                            .map_err(|_| format!("Invalid API Key header name: {key}"))?;
                        let val = HeaderValue::from_str(&value)
                            .map_err(|_| format!("Invalid API Key header value"))?;
                        builder = builder.header(name, val);
                    }
                }
            }
            other => return Err(format!("Unsupported auth type: {other}")),
        }
        Ok(builder)
    }
    ```
  - [ ] In `send_request`, remove the existing auth guard (`if request.auth.r#type != "none"`) and call `apply_auth` **after** `build_url` and before sending:
    ```rust
    let method = build_method(&request.method)?;
    let mut url = build_url(&request.url, &request.queryParams)?;
    let headers = build_headers(&request.headers)?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let mut request_builder = client.request(method, url.clone()).headers(headers);
    // Apply auth before body — may mutate url (API Key query) or add headers (bearer/basic/api-key header)
    request_builder = apply_auth(request_builder, &request.auth, &mut url)?;
    // Re-apply the potentially mutated URL
    request_builder = request_builder.url(url);
    ```
    **NOTE**: `reqwest::RequestBuilder` does not expose a `.url()` setter after construction. The correct pattern is to build URL **including** API key query before creating the builder, or rebuild the builder with the mutated URL. See "Rust Auth Injection Pattern" under Dev Notes for the recommended approach.

- [ ] Task 5 — Add tests (AC: 1–12)
  - [ ] `dispatch/src/components/AuthPanel/AuthPanel.test.tsx` (new file): 
    - Test 1: renders "No auth" dropdown by default with `type='none'`
    - Test 2: switching to Bearer Token shows token input; onChange fires with `{ type: 'bearer', token: '' }`
    - Test 3: Bearer token input change fires `onAuthChange` with updated token
    - Test 4: switching to Basic Auth shows username + password inputs
    - Test 5: Basic username/password changes call `onAuthChange` correctly
    - Test 6: switching to API Key shows key-name, key-value, location select
    - Test 7: API Key location toggle (header → query) calls `onAuthChange` with `in: 'query'`
    - Test 8: switching back to None resets to minimal `{ type: 'none' }` display
  - [ ] `dispatch/src/stores/requestStore.test.ts` (extend): add 2 tests for `setAuth` action
    - Test: `setAuth` updates auth state and marks `isDirty = true`
    - Test: `setAuth` with `type: 'none'` sets `{ type: 'none' }` correctly

- [ ] Task 6 — Quality gates
  - [ ] Run `yarn typecheck` from `dispatch/` — no TypeScript errors
  - [ ] Run `yarn test` from `dispatch/` — all tests pass (currently 202+ tests, add ~10 new ones)

- [ ] Final Task — Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 3.3

## Dev Notes

### Story Foundation

Story 3.3 is the **final story in Epic 3** (Environments & Auth). It depends on:
- **Story 3.1**: `environmentStore`, `EnvironmentPanel`, DB schema — all in place, do not touch
- **Story 3.2**: `useEnvironment` hook, `interpolate` lib — in place, do not touch; the `auth` object passed to `invoke()` is intentionally **not interpolated** (credentials should not contain `{{variable}}` tokens)

The `auth_type` and `auth_config` columns on the `Request` DB model are already defined in the SQLite schema and the TypeScript `Request` interface (`@/lib/db`). The round-trip loading via `authConfigToState()` in `requestStore.ts` is already implemented and handles all 4 types. **No DB migration needed.**

### Critical: `setAuth` Is Missing from `requestStore.ts`

The `RequestState` interface defines `auth: AuthState` but has **no `setAuth` action**. This is the highest-priority task. The `AuthPanel` component will call `onAuthChange(setAuth)`. Without it, auth state changes will be silently discarded.

Pattern to add (mirror `setBodyRaw`):
```typescript
// In RequestState interface:
setAuth: (auth: AuthState) => void;

// In zustand immer store body:
setAuth: (auth) =>
    set((state) => {
        state.auth = auth;
        state.isDirty = true;
    }),
```

### Critical: Rust Auth Injection Pattern

`reqwest`'s `RequestBuilder` does not expose a `.url()` setter after construction. The correct pattern for API Key query injection is to handle the URL mutation **before** creating the `RequestBuilder`:

```rust
#[tauri::command]
pub async fn send_request(request: SendRequestPayload) -> Result<SendResponsePayload, String> {
    let method = build_method(&request.method)?;
    let mut url = build_url(&request.url, &request.queryParams)?;
    let headers = build_headers(&request.headers)?;

    // Inject API Key query param into URL BEFORE building the request
    if request.auth.r#type == "api-key" {
        if request.auth.r#in.as_deref() == Some("query") {
            let key = request.auth.key.as_deref().unwrap_or("");
            let value = request.auth.value.as_deref().unwrap_or("");
            if !key.is_empty() {
                url.query_pairs_mut().append_pair(key, value);
            }
        }
    }

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let mut request_builder = client.request(method, url).headers(headers);

    // Inject bearer / basic / api-key header auth
    match request.auth.r#type.as_str() {
        "bearer" => {
            let token = request.auth.token.as_deref().unwrap_or("");
            request_builder = request_builder.bearer_auth(token);
        }
        "basic" => {
            let username = request.auth.username.as_deref().unwrap_or("");
            let password = request.auth.password.as_deref().unwrap_or("");
            request_builder = request_builder.basic_auth(username, Some(password));
        }
        "api-key" => {
            // Only inject as header when in == "header" (query was handled above)
            if request.auth.r#in.as_deref().unwrap_or("header") == "header" {
                let key = request.auth.key.as_deref().unwrap_or("").to_string();
                let value = request.auth.value.as_deref().unwrap_or("").to_string();
                if !key.is_empty() {
                    let name = HeaderName::from_bytes(key.as_bytes())
                        .map_err(|_| format!("Invalid API Key header name: {key}"))?;
                    let val = HeaderValue::from_str(&value)
                        .map_err(|_| format!("Invalid API Key header value: {value}"))?;
                    request_builder = request_builder.header(name, val);
                }
            }
        }
        "none" | "" => {} // No auth
        other => return Err(format!("Unsupported auth type: {other}")),
    }

    // ... rest of send logic unchanged
}
```

`reqwest` 0.12 natively provides `.bearer_auth(token)` and `.basic_auth(username, password)` on `RequestBuilder` — **no extra crate needed**. The `base64` encoding for Basic Auth is handled internally by `reqwest`.

### AuthPanel Component Design

```tsx
// dispatch/src/components/AuthPanel/AuthPanel.tsx
import type { AuthState } from '@/stores/requestStore';

interface AuthPanelProps {
  auth: AuthState;
  onAuthChange: (auth: AuthState) => void;
}

export function AuthPanel({ auth, onAuthChange }: AuthPanelProps) {
  // Type select handler — always initialises a fresh typed default
  const handleTypeChange = (newType: AuthState['type']) => {
    switch (newType) {
      case 'bearer':   return onAuthChange({ type: 'bearer', token: '' });
      case 'basic':    return onAuthChange({ type: 'basic', username: '', password: '' });
      case 'api-key':  return onAuthChange({ type: 'api-key', key: '', value: '', in: 'header' });
      default:         return onAuthChange({ type: 'none' });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="auth-type" className="text-app-secondary mb-1 block text-xs font-medium">
          Auth Type
        </label>
        <select
          id="auth-type"
          value={auth.type}
          onChange={(e) => handleTypeChange(e.target.value as AuthState['type'])}
          className="border-app-subtle bg-app-main text-app-primary h-9 rounded-md border px-2 text-sm"
        >
          <option value="none">No Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="api-key">API Key</option>
        </select>
      </div>

      {auth.type === 'none' && (
        <p className="text-app-muted text-sm">No auth will be applied to this request.</p>
      )}

      {auth.type === 'bearer' && (
        <div>
          <label htmlFor="auth-bearer-token" className="text-app-secondary mb-1 block text-xs font-medium">Token</label>
          <input
            id="auth-bearer-token"
            type="text"
            value={auth.token}
            onChange={(e) => onAuthChange({ ...auth, token: e.target.value })}
            placeholder="Enter bearer token"
            className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm"
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="space-y-2">
          <div>
            <label htmlFor="auth-basic-username" className="text-app-secondary mb-1 block text-xs font-medium">Username</label>
            <input id="auth-basic-username" type="text" value={auth.username}
              onChange={(e) => onAuthChange({ ...auth, username: e.target.value })}
              className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm" />
          </div>
          <div>
            <label htmlFor="auth-basic-password" className="text-app-secondary mb-1 block text-xs font-medium">Password</label>
            <input id="auth-basic-password" type="password" value={auth.password}
              onChange={(e) => onAuthChange({ ...auth, password: e.target.value })}
              className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm" />
          </div>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="space-y-2">
          <div>
            <label htmlFor="auth-apikey-name" className="text-app-secondary mb-1 block text-xs font-medium">Key Name</label>
            <input id="auth-apikey-name" type="text" value={auth.key}
              onChange={(e) => onAuthChange({ ...auth, key: e.target.value })}
              placeholder="e.g. X-API-Key"
              className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm" />
          </div>
          <div>
            <label htmlFor="auth-apikey-value" className="text-app-secondary mb-1 block text-xs font-medium">Key Value</label>
            <input id="auth-apikey-value" type="text" value={auth.value}
              onChange={(e) => onAuthChange({ ...auth, value: e.target.value })}
              className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm" />
          </div>
          <div>
            <label htmlFor="auth-apikey-in" className="text-app-secondary mb-1 block text-xs font-medium">Location</label>
            <select id="auth-apikey-in" value={auth.in}
              onChange={(e) => onAuthChange({ ...auth, in: e.target.value as 'header' | 'query' })}
              className="border-app-subtle bg-app-main text-app-primary h-9 rounded-md border px-2 text-sm">
              <option value="header">Header</option>
              <option value="query">Query Param</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Auth Is NOT Interpolated

The `auth` object passed to `invoke()` goes straight from the store — it is **not** run through `applyEnv()`. This is intentional:
- Credentials should not contain `{{variable}}` tokens; env vars are for URLs and header values, not secrets.
- No change needed to `handleSendRequest()` for this story.

### Existing Infrastructure — Do Not Reinvent

| Asset | Location | Status |
|---|---|---|
| `AuthState` discriminated union type | `@/stores/requestStore.ts` (exported) | **Complete** — all 4 variants defined |
| `auth: AuthState` state field | `requestStore.ts` | **Complete** — initialized to `{ type: 'none' }` |
| `authConfigToState()` | `requestStore.ts` | **Complete** — handle load-from-saved for all 4 types |
| `authStateToConfig()` | `MainPanel.tsx` | **Complete** — handle save-to-DB for all 4 types |
| DB schema `auth_type` + `auth_config` | `environments.ts` / SQLite | **Complete** from Story 1.2 schema |
| `loadFromSaved()` action | `requestStore.ts` | **Complete** — calls `authConfigToState()` correctly |
| Auth tab placeholder | `MainPanel.tsx` line ~428 | **Stub** — replace with `<AuthPanel>` |
| `RequestAuth` struct | `src-tauri/src/http.rs` | **Stub** — extend with optional fields |
| Auth guard in `send_request` | `src-tauri/src/http.rs` | **Remove** — replace with injection logic |

### Testing Patterns (from previous stories)

- Use `vi.hoisted()` for mocks that are referenced in `vi.mock()` factory (pattern from Story 3.1 and 3.2).
- Mock `@tauri-apps/api/core` with `vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args) => invokeMock(...args) }))`.
- `fireEvent.change(select, { target: { value: 'bearer' } })` to simulate dropdown changes in tests.
- `useRequestStore.setState(...)` for test setup (already used in `MainPanel.test.tsx` `beforeEach`).
- Auth panel tests should be pure unit tests using `render()` + `fireEvent` — no store wiring needed (props-driven component).

### Project Structure Notes

- New component folder: `dispatch/src/components/AuthPanel/` (matches the `EnvironmentPanel/`, `MainPanel/` pattern)
- No new stores needed — only the existing `requestStore` gains one action
- No new lib modules needed — the auth logic lives in Rust
- No DB schema changes — `auth_type` and `auth_config` columns exist from Story 1.2
- All imports use `@/` alias — never relative `../../` paths

### References

- `AuthState` type definition: [dispatch/src/stores/requestStore.ts](dispatch/src/stores/requestStore.ts)
- Auth tab placeholder to replace: `MainPanel.tsx` — `{activeTab === 'auth' ? <p ...>Auth: None</p> : null}`
- Rust stub to extend: [dispatch/src-tauri/src/http.rs](dispatch/src-tauri/src/http.rs)
- Epic requirements: [_bmad-output/planning-artifacts/epic-3.md](_bmad-output/planning-artifacts/epic-3.md)
- Previous story learnings: [_bmad-output/implementation-artifacts/3-2-variable-interpolation.md](_bmad-output/implementation-artifacts/3-2-variable-interpolation.md)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (GitHub Copilot)

### Debug Log References

### Completion Notes List

### File List

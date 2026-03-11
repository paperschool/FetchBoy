# Story 5.5: Export Request as cURL / Code Snippet

Status: ready-for-dev

## Story

As a developer,
I want to copy the current tab's request as a ready-to-run code snippet,
so that I can quickly reproduce or share the call without manually constructing it.

## Acceptance Criteria

1. A "Copy as…" button (or `</>` icon) is added to the request builder toolbar, next to the Send button.
2. Clicking it opens a dropdown with four options: **cURL**, **Python (requests)**, **JavaScript (fetch)**, **Node.js (axios)**.
3. The generated snippet uses the fully-interpolated request — environment variables are resolved before rendering.
4. The snippet includes: method, URL, all **enabled** headers, all **enabled** query params, and the request body (where applicable).
5. Auth headers/params are injected into the snippet exactly as they would be at send time (Bearer, Basic, API Key).
6. Selecting an option copies the snippet to the clipboard and shows a transient "Copied!" toast confirmation.
7. The clipboard content is plain text; no trailing whitespace or invisible characters.
8. Generation is purely client-side (no Tauri command needed); the logic lives in a `generateSnippet(format, resolvedRequest)` utility function covered by unit tests.
9. Snippet format examples are correct and runnable (validated against known-good fixtures in unit tests).

## Tasks / Subtasks

- [ ] Task 1 — Create `generateSnippet` utility (AC: 3, 4, 5, 7, 8, 9)
  - [ ] Create `fetch-boy/src/lib/generateSnippet.ts`
  - [ ] Define exported types: `SnippetFormat = 'curl' | 'python' | 'javascript' | 'nodejs'` and `ResolvedRequest` interface (method, url, headers, queryParams, body, auth — see Dev Notes for full shape)
  - [ ] Implement `buildResolvedHeaders(req: ResolvedRequest): Array<{key: string; value: string}>` — filters to enabled headers, then injects auth:
    - `bearer`: prepend `{ key: 'Authorization', value: 'Bearer {token}' }`
    - `basic`: prepend `{ key: 'Authorization', value: 'Basic {btoa(username:password)}' }`
    - `api-key` with `in: 'header'`: prepend `{ key: auth.key, value: auth.value }`
    - `none` or `api-key` with `in: 'query'`: no header injection
  - [ ] Implement `buildResolvedUrl(req: ResolvedRequest): string` — takes `req.url`, appends all enabled query params plus any api-key query param (when `auth.in === 'query'`). Use `URL` constructor for robust param merging; fall back to manual string join if `URL` throws (invalid base URL)
  - [ ] Implement `generateSnippet(format: SnippetFormat, req: ResolvedRequest): string` — dispatches to four private format functions
  - [ ] **cURL format**: `curl -X {METHOD} '{url}' (\ -H '{key}: {value}')* (\ -d '{body}')`. Omit `-d` flag entirely when `body.mode === 'none'` or `body.raw` is empty after trim. Each `-H` flag on its own `\\\n  ` continuation line for readability. Quote order: method first, then URL, then headers, then body
  - [ ] **Python (requests) format**: assign `url = "{url}"`, `headers = {...}` dict (omit if empty), `params = {...}` dict (omit if empty — NOTE: params are already baked into the URL for cURL, but Python uses separate `params=` kwarg), `data = "{body}"` (omit if no body). Call: `response = requests.{method_lower}(url, headers=headers, params=params, data=data)` — omit unused kwargs. Final line: `print(response.json())`
  - [ ] **JavaScript (fetch) format**: `await fetch('{url}', { method: '{METHOD}', headers: {...}, body: '{body}' })` with `const data = await response.json()` and `console.log(data)`. Omit `body` key when no body. Omit `headers` key when no headers
  - [ ] **Node.js (axios) format**: `const axios = require('axios');` then `const response = await axios({ method: '{method_lower}', url: '{url}', headers: {...}, params: {...}, data: '{body}' })` — omit unused keys. Final line: `console.log(response.data)`
  - [ ] Ensure **no trailing whitespace** on any output line (trim each line or post-process with `.split('\n').map(l => l.trimEnd()).join('\n')`)
  - [ ] Export `generateSnippet`, `SnippetFormat`, `ResolvedRequest` as named exports

- [ ] Task 2 — Write `generateSnippet` unit tests (AC: 8, 9)
  - [ ] Create `fetch-boy/src/lib/generateSnippet.test.ts`
  - [ ] Define a base fixture: `POST https://api.example.com/users` with one enabled header `Content-Type: application/json`, one enabled query param `page=1`, JSON body `{"name":"Alice"}`, auth `none`
  - [ ] Test cURL fixture: verify output starts with `curl -X POST`, contains the URL with `?page=1`, contains `-H 'Content-Type: application/json'`, contains `-d '{"name":"Alice"}'`
  - [ ] Test Python fixture: verify output contains `import requests`, `requests.post(`, `'Content-Type': 'application/json'`, `'page': '1'`
  - [ ] Test JavaScript fixture: verify output contains `await fetch(`, `method: 'POST'`, `'Content-Type': 'application/json'`
  - [ ] Test Node.js fixture: verify output contains `require('axios')`, `method: 'post'`, `'Content-Type': 'application/json'`, `params:` block
  - [ ] Test **Bearer auth injection**: `auth = { type: 'bearer', token: 'tok123' }` — cURL output contains `-H 'Authorization: Bearer tok123'`; Python/JS/axios outputs contain `Authorization: Bearer tok123` in headers
  - [ ] Test **Basic auth injection**: `auth = { type: 'basic', username: 'user', password: 'pass' }` — output contains `Authorization: Basic dXNlcjpwYXNz` (base64 of `user:pass`)
  - [ ] Test **API Key auth in header**: `auth = { type: 'api-key', key: 'X-Api-Key', value: 'secret', in: 'header' }` — output contains `X-Api-Key: secret` header
  - [ ] Test **API Key auth in query**: `auth = { type: 'api-key', key: 'apikey', value: 'secret', in: 'query' }` — URL contains `apikey=secret` param; no extra header added
  - [ ] Test **disabled headers filtered out**: a disabled header is absent from the snippet
  - [ ] Test **no body when mode is 'none'**: cURL output does NOT contain `-d`, Python output does NOT contain `data=`
  - [ ] Test **no trailing whitespace**: every line of every format output must satisfy `line === line.trimEnd()`

- [ ] Task 3 — Create `CopyAsButton` component (AC: 1, 2, 6)
  - [ ] Create `fetch-boy/src/components/MainPanel/CopyAsButton.tsx`
  - [ ] Props: `interface CopyAsButtonProps { resolvedRequest: ResolvedRequest }`
  - [ ] Local state: `const [open, setOpen] = useState(false)` (dropdown visibility) and `const [copied, setCopied] = useState(false)` (toast trigger)
  - [ ] Render a button with label `</>` (or `Copy as…`) and `data-testid="copy-as-button"`. Clicking toggles `open`
  - [ ] When `open`, render a dropdown `<ul role="menu">` positioned absolutely below the button, using same Tailwind classes as existing context menus: `absolute z-50 min-w-[10rem] rounded-md border border-app-subtle bg-app-main py-1 shadow-lg text-sm right-0 top-full mt-1`
  - [ ] Four `<li>` items (use `<button role="menuitem">` pattern): `cURL`, `Python (requests)`, `JavaScript (fetch)`, `Node.js (axios)`
  - [ ] `handleCopy(format: SnippetFormat)` async handler:
    ```typescript
    const snippet = generateSnippet(format, resolvedRequest);
    await navigator.clipboard.writeText(snippet);
    setOpen(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    ```
  - [ ] Toast display: render `{copied && <span className="text-xs text-green-500 ml-2">Copied!</span>}` adjacent to the button (inline, not absolutely positioned)
  - [ ] Wrap button + dropdown in a `<div className="relative">` to scope dropdown positioning
  - [ ] Click-outside dismissal: add `useEffect` that attaches a `mousedown` handler on `document`; if click is outside the container ref, set `open(false)`. Clean up on unmount
  - [ ] `data-testid="copy-as-dropdown"` on the `<ul>` for easy test targeting

- [ ] Task 4 — Integrate `CopyAsButton` into `MainPanel` (AC: 1, 2, 3, 5)
  - [ ] Open `fetch-boy/src/components/MainPanel/MainPanel.tsx`
  - [ ] Import `CopyAsButton` and `type ResolvedRequest` from their respective modules
  - [ ] Build `resolvedRequest` object just before the `return (...)`:
    ```typescript
    const resolvedRequest: ResolvedRequest = {
      method,
      url: applyEnv(url.trim() ? (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`) : url.trim()),
      headers: headers.map((h) => ({ ...h, value: applyEnv(h.value) })),
      queryParams: queryParams.map((q) => ({ ...q, value: applyEnv(q.value) })),
      body: { ...body, raw: applyEnv(body.raw) },
      auth,
    };
    ```
    Note: auth values are NOT interpolated (consistent with `handleSendRequest` behavior)
  - [ ] In the `Controls` column flex container (the `<div className="flex items-start gap-2">` wrapping Save and Send), insert `<CopyAsButton resolvedRequest={resolvedRequest} />` **between Save and Send**

- [ ] Task 5 — Write `CopyAsButton` unit tests (AC: 1, 2, 6)
  - [ ] Create `fetch-boy/src/components/MainPanel/CopyAsButton.test.tsx`
  - [ ] Mock `navigator.clipboard.writeText` in `beforeEach`: `Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })`
  - [ ] Test: `CopyAsButton` renders a button element
  - [ ] Test: clicking the button opens the dropdown (dropdown `ul` becomes visible)
  - [ ] Test: dropdown contains all four format labels (`cURL`, `Python (requests)`, `JavaScript (fetch)`, `Node.js (axios)`)
  - [ ] Test: clicking `cURL` calls `navigator.clipboard.writeText` with a non-empty string
  - [ ] Test: after clicking a format option, the "Copied!" span appears in the DOM
  - [ ] Test: pressing `Escape` or clicking outside closes the dropdown (test the `setOpen(false)` path via mousedown outside)

- [ ] Task 6 — Final: verify and commit
  - [ ] Run `npx tsc --noEmit` from `fetch-boy/` — zero TypeScript errors
  - [ ] Run `npx vitest run` from `fetch-boy/` — all tests pass including the new `generateSnippet.test.ts` and `CopyAsButton.test.tsx`
  - [ ] Commit all code and documentation changes for this story with a message that includes `Story 5.5`

## Dev Notes

### `ResolvedRequest` — Full Type Shape

```typescript
import type { AuthState } from '@/stores/requestStore';
import type { BodyMode } from '@/stores/requestStore';

export interface ResolvedRequest {
  method: string;          // e.g. 'GET', 'POST'
  url: string;             // already env-interpolated and normalised (https:// prefix added if missing)
  headers: Array<{ key: string; value: string; enabled: boolean }>;    // env-interpolated values
  queryParams: Array<{ key: string; value: string; enabled: boolean }>; // env-interpolated values
  body: { mode: BodyMode; raw: string };  // raw is env-interpolated
  auth: AuthState;         // NOT interpolated — consistent with handleSendRequest behaviour
}
```

### Auth Injection at Send Time (Exact Logic)

Match `handleSendRequest` in `MainPanel.tsx` which delegates auth to the Rust layer. For snippets, replicate the equivalent:

| Auth Type | Snippet Injection |
|---|---|
| `none` | No injection |
| `bearer` | `Authorization: Bearer {auth.token}` header |
| `basic` | `Authorization: Basic {btoa(auth.username + ':' + auth.password)}` header |
| `api-key`, `in: 'header'` | `{auth.key}: {auth.value}` header |
| `api-key`, `in: 'query'` | Append `{auth.key}={encodeURIComponent(auth.value)}` to URL query string |

### URL Construction with Query Params

```typescript
function buildResolvedUrl(req: ResolvedRequest): string {
  const enabledParams = req.queryParams.filter((p) => p.enabled && p.key);
  const authQueryParam =
    req.auth.type === 'api-key' && req.auth.in === 'query'
      ? { key: req.auth.key, value: req.auth.value }
      : null;

  const allParams = authQueryParam ? [...enabledParams, authQueryParam] : enabledParams;

  if (allParams.length === 0) return req.url;

  const qs = allParams
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');

  return req.url.includes('?') ? `${req.url}&${qs}` : `${req.url}?${qs}`;
}
```

### cURL Snippet Format

```bash
curl -X POST 'https://api.example.com/users?page=1' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer mytoken' \
  -d '{"name":"Alice"}'
```

Rules:
- Single quotes around URL and header values
- One `-H` flag per header, on its own `  -H '...' \` line
- `-d` flag only when body exists (non-empty trim of `body.raw`)
- Last line has NO trailing ` \`

### Python (requests) Snippet Format

```python
import requests

url = "https://api.example.com/users"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer mytoken"
}
params = {"page": "1"}
data = '{"name":"Alice"}'

response = requests.post(url, headers=headers, params=params, data=data)
print(response.json())
```

Rules:
- Omit `headers = {...}` block and `headers=headers` kwarg if no resolved headers
- Omit `params = {...}` block and `params=params` kwarg if no enabled query params
- Omit `data = ...` line and `data=data` kwarg if `body.mode === 'none'` or body is empty
- Python uses separate `params=` for query params — do NOT bake them into the URL

### JavaScript (fetch) Snippet Format

```javascript
const response = await fetch('https://api.example.com/users?page=1', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mytoken'
  },
  body: '{"name":"Alice"}'
});

const data = await response.json();
console.log(data);
```

Rules:
- Omit `headers` key from options object if no resolved headers
- Omit `body` key from options object if no body
- URL contains baked-in query params (same as cURL)

### Node.js (axios) Snippet Format

```javascript
const axios = require('axios');

const response = await axios({
  method: 'post',
  url: 'https://api.example.com/users',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mytoken'
  },
  params: { page: '1' },
  data: '{"name":"Alice"}'
});

console.log(response.data);
```

Rules:
- `method` is lowercased
- axios uses separate `params` object (not baked into URL — unlike cURL and fetch)
- Omit `headers`, `params`, or `data` keys if they are empty
- `url` does NOT include query params (they go in `params`)

### No Trailing Whitespace

Post-process any generated snippet like:
```typescript
return snippet.split('\n').map((line) => line.trimEnd()).join('\n');
```

### Toast Implementation (No External Library)

No toast library is installed in this project. Implement the "Copied!" feedback inline via local React state:

```typescript
const [copied, setCopied] = useState(false);

const handleCopy = async (format: SnippetFormat) => {
  const snippet = generateSnippet(format, resolvedRequest);
  await navigator.clipboard.writeText(snippet);
  setOpen(false);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

Render inline: `{copied && <span className="text-xs text-green-500 ml-2">Copied!</span>}`

### `navigator.clipboard` in Tauri

`navigator.clipboard.writeText()` works in Tauri's WebView without any extra Rust command or permissions configuration. It is available in all modern WebView implementations used by Tauri.

### `btoa()` for Basic Auth Base64

`btoa()` is a global browser API available in jsdom (test environment) and all browsers. No import needed:

```typescript
const encoded = btoa(`${auth.username}:${auth.password}`);
```

### Toolbar Placement

The controls area in `MainPanel.tsx` is:

```tsx
<div className="flex items-start gap-2">
  <button ...>Save</button>   // existing
  <CopyAsButton ... />         // NEW — insert here
  <button ...>Send</button>   // existing
</div>
```

The outer grid column is `auto` in `grid-cols-[8rem_1fr_auto]` — adding `CopyAsButton` expands the column width automatically.

### No Tauri Command Required

The AC explicitly states generation is purely client-side. Do NOT add a Rust command for snippet generation. The only Tauri API interaction is `navigator.clipboard` (browser API, not Tauri invoke).

### Project Structure Notes

```
fetch-boy/src/
  lib/
    generateSnippet.ts        ← NEW utility (pure functions, no React)
    generateSnippet.test.ts   ← NEW unit tests
  components/
    MainPanel/
      CopyAsButton.tsx         ← NEW component
      CopyAsButton.test.tsx    ← NEW tests
      MainPanel.tsx            ← MODIFY: import CopyAsButton, build resolvedRequest, place in toolbar
```

### References

- [Source: fetch-boy/src/components/MainPanel/MainPanel.tsx] — toolbar structure, `handleSendRequest`, `applyEnv` usage, auth types
- [Source: fetch-boy/src/stores/requestStore.ts] — `AuthState`, `HttpMethod`, `BodyMode`, `KeyValueRow` types
- [Source: fetch-boy/src/stores/tabStore.ts] — `RequestSnapshot`, `useTabStore`
- [Source: fetch-boy/src/hooks/useEnvironment.ts] — `interpolate` from `useEnvironment()`
- [Source: fetch-boy/src/lib/interpolate.ts] — `interpolate()` function
- [Source: _bmad-output/planning-artifacts/epic-5.md#Story 5.5]
- [Source: _bmad-output/implementation-artifacts/5-4-tab-keyboard-shortcuts-and-reordering.md] — context menu Tailwind class pattern, hook mount pattern

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

### File List

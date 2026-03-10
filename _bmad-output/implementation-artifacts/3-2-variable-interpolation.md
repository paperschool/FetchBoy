# Story 3.2: Variable Interpolation

Status: review

<!-- Validation: optional. Run validate-create-story checklist before dev-story if desired. -->

## Story

As a developer using Dispatch,
I want `{{variable}}` tokens in my request URL, headers, query params, and body to be replaced with values from the active environment at send time,
so that I can manage dev/staging/prod configurations in one place without editing requests manually.

## Acceptance Criteria

1. `{{variable}}` tokens in the URL are replaced with active environment values immediately before the HTTP request is sent to Rust.
2. The same substitution applies to header **values**, query param **values**, and the raw body string (keys are never interpolated).
3. Variables with `enabled: false` are treated as undefined — their tokens are **not** substituted.
4. Substitution is **non-destructive**: the stored request in `requestStore` always retains the raw `{{variable}}` tokens; only the payload sent to Rust is interpolated.
5. If the active URL string contains one or more `{{token}}` patterns that cannot be resolved (no matching enabled variable), a small warning indicator appears below the URL input listing the unresolved variable names.
6. A `useEnvironment` hook at `dispatch/src/hooks/useEnvironment.ts` exposes:
   - `interpolate(str: string): string` — replaces all `{{key}}` occurrences using enabled variables from the active environment.
   - `unresolvedIn(str: string): string[]` — returns the list of unresolved `{{key}}` tokens found in a string.
7. When no environment is active, `interpolate(str)` returns `str` unchanged (no variables to resolve).
8. Import/export of environments is **out of scope** (deferred to Story 4.2).

Final Step: Commit all code and documentation changes for Story 3.2 before marking the story complete.

## Tasks / Subtasks

- [x] Task 1 - Create `dispatch/src/lib/interpolate.ts` with pure interpolation helpers (AC: 1, 2, 3, 4, 6)
  - [x] Export `interpolate(template: string, variables: KeyValuePair[]): string` — scan `template` for `{{key}}` patterns using a global regex; replace each matched token with the `value` from the first `KeyValuePair` where `pair.key === key && pair.enabled === true`; leave the token unchanged if no matching enabled pair is found.
  - [x] Export `unresolvedTokens(template: string, variables: KeyValuePair[]): string[]` — return a deduplicated list of `{{key}}` token names found in `template` that have no matching enabled variable. These are the raw key names (without braces), sorted alphabetically for deterministic output.
  - [x] Use the regex `/\{\{([^}]+)\}\}/g` to match tokens.
  - [x] Do **not** import from stores or React — this must be a pure, dependency-free utility module.

- [x] Task 2 - Create `dispatch/src/hooks/useEnvironment.ts` (AC: 6, 7)
  - [x] Import `useEnvironmentStore` from `@/stores/environmentStore`.
  - [x] Import `interpolate` and `unresolvedTokens` from `@/lib/interpolate`.
  - [x] The hook reads `environments` and `activeEnvironmentId` from `useEnvironmentStore`.
  - [x] Derive `activeVariables: KeyValuePair[]` — the `variables` array of the environment whose `id === activeEnvironmentId`, or `[]` if no active environment.
  - [x] Return `{ interpolate: (str: string) => interpolate(str, activeVariables), unresolvedIn: (str: string) => unresolvedTokens(str, activeVariables), activeVariables }`.
  - [x] Export as `useEnvironment`.

- [x] Task 3 - Apply interpolation at send time in `MainPanel.tsx` (AC: 1, 2, 4)
  - [x] Import `useEnvironment` from `@/hooks/useEnvironment`.
  - [x] Call `const { interpolate: applyEnv } = useEnvironment();` at the top of the `MainPanel` component function (alongside other hooks).
  - [x] Inside `handleSendRequest()`, compute interpolated send values **without mutating the store**:
    - `const sendUrl = applyEnv(normalizedUrl);`
    - `const sendHeaders = headers.map(h => ({ ...h, value: applyEnv(h.value) }));`
    - `const sendQueryParams = queryParams.map(q => ({ ...q, value: applyEnv(q.value) }));`
    - `const sendBody = { ...body, raw: applyEnv(body.raw) };`
  - [x] Pass `sendUrl`, `sendHeaders`, `sendQueryParams`, `sendBody` to the `invoke()` call and to `normalizedUrl` used in `persistHistoryEntry` (the history snapshot should use `sendUrl` since it records the actual sent URL, not the template).
  - [x] The `requestSnapshot` that is passed to `persistHistoryEntry` should use `sendUrl`, `sendHeaders`, `sendQueryParams` so history shows what was actually sent.
  - [x] The `requestStore` state (`url`, `headers`, `queryParams`, `body`) **must not be modified** — only the local send-time variables are interpolated.

- [x] Task 4 - Add unresolved variable warning below the URL input in `MainPanel.tsx` (AC: 5)
  - [x] Import `useEnvironment` (already imported via Task 3).
  - [x] Inside the `MainPanel` component, derive `const { unresolvedIn } = useEnvironment();`.
  - [x] Compute `const unresolvedVars = unresolvedIn(url);` (live, on every render, based on the raw store `url` string).
  - [x] Below the URL `<input>` element (and its containing `<div>`), add a conditional warning block.
  - [x] The warning appears inside the URL column `<div>`, directly after the `<input>`.
  - [x] No orange underline on the input itself — input appearance unchanged.

- [x] Task 5 - Add tests (AC: 1–7)
  - [x] `dispatch/src/lib/interpolate.test.ts` (new): 12 tests covering all interpolate/unresolvedTokens scenarios.
  - [x] `dispatch/src/hooks/useEnvironment.test.ts` (new): 5 tests covering hook wiring.
  - [x] `dispatch/src/components/MainPanel/MainPanel.test.tsx` (extended): 3 new test cases covering interpolated URL send, unresolved warning display, no-warning case.

- [x] Task 6 - Quality gates
  - [x] Run `yarn test` from `dispatch/` — all 197 tests pass.
  - [x] Run `yarn typecheck` from `dispatch/` — no TypeScript errors.

- [x] Final Task - Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 3.2.

## Dev Notes

### Story Foundation

Story 3.2 is the second story in Epic 3 (Environments & Auth). It **depends on Story 3.1** — the environment infrastructure (`environments.ts`, `environmentStore.ts`, `EnvironmentPanel`, `TopBar` env selector) was fully implemented in 3.1 and must not be reinvented here.

**No new DB schema needed.** Variables are already stored as `KeyValuePair[]` in the `environments.variables` column (JSON TEXT), fully managed by Story 3.1.

### Critical: Pure Interpolation Layer (`@/lib/interpolate.ts`)

The regex `/\{\{([^}]+)\}\}/g` captures the key name inside the braces. The interpolation should:
- Replace globally (all occurrences in one pass)
- Only match enabled variables (`pair.enabled === true`)
- Leave unmatched tokens verbatim (so the user can see exactly what didn't resolve)
- Be **side-effect free** — no store access, no React

```typescript
export function interpolate(template: string, variables: KeyValuePair[]): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const found = variables.find((v) => v.key === key && v.enabled);
    return found ? found.value : match; // leave unchanged if not found
  });
}
```

### Critical: Non-Destructive Send Flow in `MainPanel.tsx`

The existing `handleSendRequest()` directly uses `url`, `headers`, `queryParams`, `body` from the store and passes them to `invoke()`. Story 3.2 maps over these at send time — **the store values must not change**. The pattern:

```typescript
const sendUrl = applyEnv(normalizedUrl);
const sendHeaders = headers.map((h) => ({ ...h, value: applyEnv(h.value) }));
const sendQueryParams = queryParams.map((q) => ({ ...q, value: applyEnv(q.value) }));
const sendBody = { ...body, raw: applyEnv(body.raw) };
```

Then pass these to `invoke()`:
```typescript
invoke<ResponseData>('send_request', {
  request: {
    method,
    url: sendUrl,         // ← interpolated
    headers: sendHeaders, // ← interpolated values
    queryParams: sendQueryParams, // ← interpolated values
    body: sendBody,       // ← interpolated raw body
    auth,                 // ← auth unchanged (Story 3.3)
  },
})
```

And use `sendUrl` in `requestSnapshot` and `persistHistoryEntry` so history records the **actual** sent URL.

### Hook Design (`@/hooks/useEnvironment.ts`)

The hook is a thin React adapter layer over the pure `interpolate` util:

```typescript
import { useEnvironmentStore } from '@/stores/environmentStore';
import { interpolate, unresolvedTokens } from '@/lib/interpolate';
import type { KeyValuePair } from '@/lib/db';

export function useEnvironment() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
  const activeVariables: KeyValuePair[] = activeEnv?.variables ?? [];

  return {
    interpolate: (str: string) => interpolate(str, activeVariables),
    unresolvedIn: (str: string) => unresolvedTokens(str, activeVariables),
    activeVariables,
  };
}
```

### Keys vs Values — What Gets Interpolated

| Field | Interpolate? |
|---|---|
| URL | ✅ Yes — the entire string |
| Header **value** | ✅ Yes |
| Header **key** | ❌ No — header key names are not templated |
| Query param **value** | ✅ Yes |
| Query param **key** | ❌ No |
| Body `raw` | ✅ Yes |

### Unresolved Variable Warning

The warning is **URL-only** — it only reads `unresolvedIn(url)` where `url` is the raw `requestStore.url`. It does **not** scan headers/params/body (too noisy). The warning renders in the middle column of the URL row `<div>`:

```tsx
<div>
  <label ...>Request URL</label>
  <input id="request-url" value={url} ... />
  {unresolvedVars.length > 0 && (
    <p className="mt-1 text-xs text-orange-400">
      ⚠ Unresolved: {unresolvedVars.map((v) => `{{${v}}}`).join(', ')}
    </p>
  )}
</div>
```

### Existing Infrastructure — Do Not Reinvent

| Asset | Location | Status |
|---|---|---|
| `Environment` + `KeyValuePair` interfaces | `@/lib/db` | Complete — use as-is |
| `environmentStore.ts` | `@/stores/environmentStore.ts` | Complete (Story 3.1) |
| `environments.ts` CRUD | `@/lib/environments.ts` | Complete (Story 3.1) |
| `useEnvironmentStore` | `@/stores/environmentStore.ts` | Verified — exposes `environments`, `activeEnvironmentId` |
| `handleSendRequest()` | `MainPanel.tsx` | Uses `url`, `headers`, `queryParams`, `body`, `auth` from store — extend in-place |
| `requestStore.ts` | `@/stores/requestStore.ts` | **Do NOT modify** — only read from it |

### Architecture Compliance

- All imports must use `@/` alias — never relative `../../` paths.
- The new `hooks/` directory (`dispatch/src/hooks/`) must be created — it does not exist yet.
- The `interpolate.ts` lib must be **pure** (no imports from stores, React, or Tauri).
- Stores use Zustand + Immer — do not change the requestStore; observe only.
- CSS colour tokens from `index.css`: use `text-orange-400` for the unresolved warning (Tailwind standard colour, not a custom token).

### Testing Patterns (from previous stories)

- Use `vi.hoisted()` for mocks that are referenced in `vi.mock()` factory to avoid hoisting ReferenceErrors (pattern established in Story 3.1).
- `collections.test.ts` and `environments.test.ts` show the DB mock pattern: `vi.mock('@/lib/db', () => ({ getDb: vi.fn().mockResolvedValue(mockDb) }))`.
- Store tests use `store.setState(...)` directly from `beforeEach` resets (see `historyStore.test.ts`).
- `MainPanel.test.tsx` uses `vi.mock('@tauri-apps/api/core', ...)` — any new mocks added must also use `vi.hoisted()` if referenced in factory.

### References

- [Source: _bmad-output/planning-artifacts/epic-3.md#Story 3.2]
- [Source: dispatch/src/lib/environments.ts] — existing variables infrastructure
- [Source: dispatch/src/stores/environmentStore.ts] — store with `activeEnvironmentId`, `environments`
- [Source: dispatch/src/components/MainPanel/MainPanel.tsx] — send flow to extend
- [Source: dispatch/src/stores/requestStore.ts] — store to observe (not modify)
- [Source: dispatch/src/lib/db.ts] — `KeyValuePair` type definition

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- Pure interpolation layer implemented with local regex per function to avoid `/g` flag stateful `lastIndex` issues.
- `unresolvedVars` derived once per render (not inline in JSX) to avoid duplicate calls to `unresolvedIn`.
- `hooks/` directory already existed (`.gitkeep` only) — no directory creation needed.
- All 197 tests pass; `yarn typecheck` clean.

### File List

- `dispatch/src/lib/interpolate.ts` (new)
- `dispatch/src/lib/interpolate.test.ts` (new)
- `dispatch/src/hooks/useEnvironment.ts` (new)
- `dispatch/src/hooks/useEnvironment.test.ts` (new)
- `dispatch/src/components/MainPanel/MainPanel.tsx` (modified)
- `dispatch/src/components/MainPanel/MainPanel.test.tsx` (modified)

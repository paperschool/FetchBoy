# Story 4.3: Settings Panel

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Dispatch user,
I want a settings panel accessible from a gear icon in the top bar,
so that I can configure theme, request timeout, SSL verification, and editor font size — all persisted across restarts.

## Acceptance Criteria

1. **Settings access**: a gear icon (⚙) button in the TopBar opens the settings modal.
2. **Theme selector**: three options — Light / Dark / System — implemented via radio buttons or a styled select; selecting one applies the theme instantly and persists to SQLite.
3. **Request timeout**: numeric input (milliseconds); min 100, max 300,000; default 30,000; persists to SQLite; read by `send_request` at use time.
4. **SSL certificate verification**: a toggle (checkbox or switch); on by default; persists to SQLite; read by `send_request` at use time.
5. **Editor font size**: integer stepper (range 10–24, default 14); persists to SQLite; read by Monaco Editor at use time.
6. All settings persist to SQLite via `saveSetting` on every change (individual saves, not batched).
7. Settings loaded from SQLite at app startup — already bootstrapped in `AppShell.tsx`; newly added settings (`ssl_verify`, `requestTimeoutMs`) must be added to the same boot call.
8. `send_request` Rust command reads `timeout_ms` and `ssl_verify` from the invoke payload (not hardcoded).
9. `MainPanel.tsx` reads `request_timeout_ms` and `ssl_verify` from `uiSettingsStore` and passes them in the `send_request` invoke payload.
10. The existing theme toggle button in TopBar is **removed** (it moves into SettingsPanel).

## Tasks / Subtasks

- [ ] Task 1 — Extend `AppSettings.theme` type and update defaults (AC: 2)
  - [ ] Open `dispatch/src/lib/db.ts`
  - [ ] Change `AppSettings.theme` type from `'light' | 'dark'` to `'light' | 'dark' | 'system'`
  - [ ] Open `dispatch/src/lib/settings.ts`
  - [ ] Change the `theme` fallback in `loadAllSettings` return from `'light'` to `'system'`
  - [ ] Change the catch-block default `theme` from `'light'` to `'system'`

- [ ] Task 2 — Extend `uiSettingsStore.ts` with all four settings fields (AC: 3, 4, 5)
  - [ ] Open `dispatch/src/stores/uiSettingsStore.ts`
  - [ ] Update `UiSettingsState` interface:
    - Change `theme` type to `'light' | 'dark' | 'system'`
    - Change `setTheme` parameter type to `'light' | 'dark' | 'system'`
    - Add `requestTimeoutMs: number`
    - Add `setRequestTimeoutMs: (ms: number) => void`
    - Add `sslVerify: boolean`
    - Add `setSslVerify: (v: boolean) => void`
  - [ ] Update store initial state:
    - Change `theme` default to `'system'` (was `'light'`)
    - Add `requestTimeoutMs: 30000`
    - Add `setRequestTimeoutMs: (ms) => set({ requestTimeoutMs: ms })`
    - Add `sslVerify: true`
    - Add `setSslVerify: (v) => set({ sslVerify: v })`
  - [ ] Keep `editorFontSize: 13` default and the `setEditorFontSize` action as-is (the DB value 14 will override at startup)

- [ ] Task 3 — Update `useTheme.ts` to handle 'system' mode (AC: 2)
  - [ ] Open `dispatch/src/hooks/useTheme.ts`
  - [ ] Replace the simple toggle with full three-way logic:
    ```typescript
    import { useEffect } from 'react';
    import { useUiSettingsStore } from '@/stores/uiSettingsStore';

    export function useTheme() {
      const theme = useUiSettingsStore((s) => s.theme);

      useEffect(() => {
        if (theme === 'light') {
          document.documentElement.classList.remove('dark');
          return;
        }
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
          return;
        }
        // system mode
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        document.documentElement.classList.toggle('dark', mq.matches);
        const handler = (e: MediaQueryListEvent) => {
          document.documentElement.classList.toggle('dark', e.matches);
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
      }, [theme]);
    }
    ```

- [ ] Task 4 — Bootstrap new settings in `AppShell.tsx` (AC: 7)
  - [ ] Open `dispatch/src/components/Layout/AppShell.tsx`
  - [ ] In the `.then` callback of `loadAllSettings`, add:
    - `useUiSettingsStore.getState().setRequestTimeoutMs(s.request_timeout_ms);`
    - `useUiSettingsStore.getState().setSslVerify(s.ssl_verify);`
  - [ ] The existing `setTheme` and `setEditorFontSize` calls remain unchanged
  - [ ] Final block should read:
    ```typescript
    loadAllSettings()
      .then((s) => {
        useUiSettingsStore.getState().setTheme(s.theme);
        useUiSettingsStore.getState().setEditorFontSize(s.editor_font_size);
        useUiSettingsStore.getState().setRequestTimeoutMs(s.request_timeout_ms);
        useUiSettingsStore.getState().setSslVerify(s.ssl_verify);
      })
      .catch(() => {});
    ```

- [ ] Task 5 — Update Rust `send_request` to accept `timeout_ms` and `ssl_verify` (AC: 8)
  - [ ] Open `dispatch/src-tauri/src/http.rs`
  - [ ] Add `timeout_ms: u64` and `ssl_verify: bool` fields to `SendRequestPayload`:
    ```rust
    #[derive(Debug, Deserialize)]
    pub struct SendRequestPayload {
        pub method: String,
        pub url: String,
        pub headers: Vec<KeyValueRow>,
        pub queryParams: Vec<KeyValueRow>,
        pub body: RequestBody,
        pub auth: RequestAuth,
        pub timeout_ms: u64,
        pub ssl_verify: bool,
    }
    ```
  - [ ] Replace the hardcoded `Client::builder()` block in `send_request`:
    ```rust
    let client = Client::builder()
        .timeout(std::time::Duration::from_millis(request.timeout_ms))
        .danger_accept_invalid_certs(!request.ssl_verify)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;
    ```
  - [ ] No other changes to http.rs — all other logic remains identical

- [ ] Task 6 — Pass settings from `MainPanel.tsx` to `send_request` invoke (AC: 9)
  - [ ] Open `dispatch/src/components/MainPanel/MainPanel.tsx`
  - [ ] Import `useUiSettingsStore` from `@/stores/uiSettingsStore`
  - [ ] Inside the component, read settings:
    ```typescript
    const requestTimeoutMs = useUiSettingsStore((s) => s.requestTimeoutMs);
    const sslVerify = useUiSettingsStore((s) => s.sslVerify);
    ```
  - [ ] Update the `invoke('send_request', {...})` call to include `timeout_ms` and `ssl_verify`:
    ```typescript
    invoke<ResponseData>('send_request', {
      request: {
        method,
        url: sendUrl,
        headers: sendHeaders,
        queryParams: sendQueryParams,
        body: sendBody,
        auth,
        timeout_ms: requestTimeoutMs,
        ssl_verify: sslVerify,
      },
    })
    ```
  - [ ] Update `invokeWithTimeout` call: pass `requestTimeoutMs + 5000` instead of the constant `SEND_TIMEOUT_MS` to give a frontend buffer of 5 s above the Rust timeout:
    ```typescript
    const response = await invokeWithTimeout(
      invoke<ResponseData>('send_request', { request: { ..., timeout_ms: requestTimeoutMs, ssl_verify: sslVerify } }),
      requestTimeoutMs + 5000,
    );
    ```
  - [ ] Remove or leave the `SEND_TIMEOUT_MS = 15000` constant — it is no longer used (delete the line)

- [ ] Task 7 — Create `Settings/SettingsPanel.tsx` component (AC: 1–6)
  - [ ] Create `dispatch/src/components/Settings/SettingsPanel.tsx`
  - [ ] Pattern: same overlay modal style as `EnvironmentPanel` — fixed full-screen backdrop, centred white/dark card
  - [ ] Props interface:
    ```typescript
    interface SettingsPanelProps {
      open: boolean;
      onClose: () => void;
    }
    ```
  - [ ] Reads from `useUiSettingsStore`: `theme`, `requestTimeoutMs`, `sslVerify`, `editorFontSize`
  - [ ] Each change calls the store setter AND `saveSetting(key, value)` — import `saveSetting` from `@/lib/settings`
  - [ ] **Theme selector** — three radio buttons: `Light`, `Dark`, `System`; label text only; on change: `setTheme(value)` + `saveSetting('theme', value)`
  - [ ] **Request timeout** — `<input type="number" min={100} max={300000} step={100} />` bound to `requestTimeoutMs`; `onChange`: `setRequestTimeoutMs(clamped)` + `saveSetting('request_timeout_ms', clamped)` — clamp to [100, 300000] before storing
  - [ ] **SSL verify** — `<input type="checkbox" />` bound to `sslVerify`; `onChange`: `setSslVerify(checked)` + `saveSetting('ssl_verify', checked)`
  - [ ] **Editor font size** — two buttons `−` and `+` with numeric display between; range [10, 24]; `onClick`: `setEditorFontSize(clamped)` + `saveSetting('editor_font_size', clamped)`
  - [ ] Close button or backdrop click calls `onClose()`
  - [ ] Use CSS custom properties via existing utility classes (`bg-app-main`, `text-app-primary`, `border-app-subtle`) — do **not** hard-code hex colours
  - [ ] Full JSX outline:
    ```tsx
    if (!open) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={onClose}
        data-testid="settings-overlay"
      >
        <div
          className="bg-app-main border border-app-subtle rounded-lg p-6 w-96 space-y-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
          data-testid="settings-panel"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-app-primary font-semibold text-base">Settings</h2>
            <button aria-label="Close settings" onClick={onClose} className="...">✕</button>
          </div>
          {/* Theme section */}
          {/* Timeout section */}
          {/* SSL verify section */}
          {/* Font size section */}
        </div>
      </div>
    );
    ```

- [ ] Task 8 — Update `TopBar.tsx` (AC: 1, 10)
  - [ ] Open `dispatch/src/components/TopBar/TopBar.tsx`
  - [ ] Add `settingsPanelOpen` state: `const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);`
  - [ ] Import `SettingsPanel` from `@/components/Settings/SettingsPanel`
  - [ ] **Remove** the theme toggle button (the `☀️`/`🌙` button and `handleThemeChange`)
  - [ ] **Remove** the `theme` and `saveSetting` imports if no longer used in this file
  - [ ] Keep the env selector `<select>` and "Manage environments" `<button>` — they stay for environment management
  - [ ] Change the existing `⚙` button to open the settings panel:
    ```tsx
    <button
      aria-label="Open settings"
      className="text-xs text-app-inverse border border-white/20 rounded px-2 py-1 hover:bg-white/10"
      onClick={() => setSettingsPanelOpen(true)}
    >
      ⚙
    </button>
    ```
  - [ ] Add a separate env manage button (keep existing but update aria-label if changed):
    - The existing `⚙` with `aria-label="Manage environments"` must be repurposed or a new button added. Recommended: rename existing to `≡` (trigram) or keep `⚙` with aria-label `"Manage environments"` and add a NEW `⚙` for settings.
    - **Simplest approach**: keep the existing env-manage button with `aria-label="Manage environments"` (opening `EnvironmentPanel`) and add a NEW button with `aria-label="Open settings"` (opening `SettingsPanel`).
    - New TopBar right area order: `[env select] [⚙ Manage environments] [⚙ Open settings]`
  - [ ] Render `SettingsPanel` at end of JSX (alongside existing EnvironmentPanel render):
    ```tsx
    {settingsPanelOpen && (
      <SettingsPanel open={settingsPanelOpen} onClose={() => setSettingsPanelOpen(false)} />
    )}
    ```
  - [ ] Keep `EnvironmentPanel` render logic unchanged

- [ ] Task 9 — Tests (AC: 1–10)
  - [ ] Create `dispatch/src/components/Settings/SettingsPanel.test.tsx`:
    - Mock `@/stores/uiSettingsStore` (all four fields + setters)
    - Mock `@/lib/settings` (`saveSetting` → `vi.fn().mockResolvedValue(undefined)`)
    - **Render tests** (testing-library):
      - Settings panel renders when `open=true`; does not render when `open=false`
      - Theme radio: the currently active theme option is selected
      - Timeout input: shows current `requestTimeoutMs` value
      - SSL verify checkbox: checked state reflects `sslVerify`
      - Font size display: shows `editorFontSize`
    - **Interaction tests**:
      - Clicking overlay calls `onClose`
      - Clicking panel body does NOT call `onClose` (stopPropagation)
      - Clicking close button calls `onClose`
      - Selecting "Dark" theme radio → calls `setTheme('dark')` and `saveSetting('theme', 'dark')`
      - Changing timeout input → calls `setRequestTimeoutMs` and `saveSetting` with clamped value
      - Toggling SSL checkbox → calls `setSslVerify` and `saveSetting`
      - Clicking `+` font size button → calls `setEditorFontSize(n+1)` and `saveSetting`
      - Clicking `−` at min 10 → does NOT call setter (clamped)
  - [ ] Update `dispatch/src/components/TopBar/TopBar.test.tsx`:
    - Remove tests for the theme toggle button (it no longer exists)
    - Add: "renders Open settings button with correct aria-label"
    - Add: "clicking Open settings button opens SettingsPanel"
    - Mock `@/components/Settings/SettingsPanel` similarly to how `EnvironmentPanel` is mocked
  - [ ] Update `dispatch/src/hooks/useTheme.test.ts` (if exists) or create it:
    - Test `theme === 'system'` adds `.dark` when `matchMedia` matches dark
    - Test `theme === 'system'` removes `.dark` when `matchMedia` matches light
    - Test `theme === 'system'` attaches and cleans up media query listener
    - Test `theme === 'light'` removes `.dark` class
    - Test `theme === 'dark'` adds `.dark` class
  - [ ] Update `dispatch/src/stores/uiSettingsStore.test.ts`:
    - Test: initial `theme` is `'system'`
    - Test: `setRequestTimeoutMs` updates `requestTimeoutMs`
    - Test: initial `sslVerify` is `true`
    - Test: `setSslVerify(false)` updates store

- [ ] Task 10 — Quality gates
  - [ ] Run `npx tsc --noEmit` from `dispatch/` — zero TypeScript errors
  - [ ] Run `npx vitest run` from `dispatch/` — all tests pass
  - [ ] Manually verify in `yarn tauri dev`:
    - Gear icon opens settings modal
    - Each setting change applies immediately (theme flips instantly, font size updates Monaco)
    - Restart the app → settings persist

- [ ] Final Task — Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 4.3

## Dev Notes

### Critical: Codebase State After Story 4.2

The current production code (commit `7db17b3`) does NOT fully match Story 4.1's spec for theme:

| Item | Story 4.1 Spec | Actual Code |
|---|---|---|
| `AppSettings.theme` type | `'light' \| 'dark' \| 'system'` | `'light' \| 'dark'` |
| `uiSettingsStore.theme` type | `'light' \| 'dark' \| 'system'` | `'light' \| 'dark'` |
| `uiSettingsStore` default theme | `'system'` | `'light'` |
| `useTheme.ts` system support | `matchMedia` + listener | Not implemented |
| TopBar theme toggle | cycles light → dark → system | cycles light → dark only |

**Tasks 1–3 of this story close this gap.** Treat them as mandatory prerequisites even though they relate to Story 4.1's requirements.

### `AppSettings` Interface — `db.ts`

```typescript
// dispatch/src/lib/db.ts
export interface AppSettings {
    theme: 'light' | 'dark' | 'system'; // ← add 'system' (Task 1)
    request_timeout_ms: number;
    ssl_verify: boolean;
    editor_font_size: number;
}
```

`getDb()` is a singleton — do NOT call `Database.load()` anywhere. Always use `getDb()` from `@/lib/db`.

### `uiSettingsStore.ts` — Current vs Target

**Current** (after 4.2 merge):
```typescript
interface UiSettingsState {
    editorFontSize: number;          // ← 13 default (DB will override to 14)
    setEditorFontSize: (n: number) => void;
    theme: 'light' | 'dark';         // ← needs 'system' added
    setTheme: (t: 'light' | 'dark') => void;
}
```

**Target** (after Story 4.3):
```typescript
interface UiSettingsState {
    editorFontSize: number;
    setEditorFontSize: (n: number) => void;
    theme: 'light' | 'dark' | 'system';
    setTheme: (t: 'light' | 'dark' | 'system') => void;
    requestTimeoutMs: number;           // ← new
    setRequestTimeoutMs: (ms: number) => void;
    sslVerify: boolean;                 // ← new
    setSslVerify: (v: boolean) => void;
}
```

Note the naming convention: **camelCase in store** (`requestTimeoutMs`, `sslVerify`) vs **snake_case in DB/settings** (`request_timeout_ms`, `ssl_verify`). Match exactly.

### Rust `send_request` Payload Expansion

`SendRequestPayload` in `dispatch/src-tauri/src/http.rs` must grow two fields. The JS side passes these as camelCase (Tauri auto-converts), but the Rust struct uses `serde(rename)` conventions. Tauri's `#[tauri::command]` uses camelCase by default when deserialising from JS.

**IMPORTANT**: Tauri serialises JS `timeout_ms` (snake_case in JS object) directly to the Rust `timeout_ms` field. Since the JS payload key is already snake_case, no `#[serde(rename = "...")]` is needed.

Verify `reqwest` supports `danger_accept_invalid_certs` — it does as of reqwest 0.11+. The project uses reqwest via Tauri's bundled version.

### `MainPanel.tsx` — Send Flow

The current invoke call is at line ~229. The `SEND_TIMEOUT_MS = 15000` constant on line 18 is a naive 15s cap regardless of user settings. After this story, the frontend timeout is `requestTimeoutMs + 5000` (5 s grace above the Rust-level timeout), eliminating the hardcoded cap.

```typescript
// Before
const response = await invokeWithTimeout(
  invoke<ResponseData>('send_request', { request: { method, url, headers, ... } }),
  SEND_TIMEOUT_MS,
);

// After
const response = await invokeWithTimeout(
  invoke<ResponseData>('send_request', {
    request: { method, url, headers, ..., timeout_ms: requestTimeoutMs, ssl_verify: sslVerify },
  }),
  requestTimeoutMs + 5000,
);
```

### CSS Utility Classes — Do Not Hard-Code Colours

From `dispatch/src/index.css`, the palette is already defined for light and dark via CSS custom properties. Always use these token classes:

| Class | Purpose |
|---|---|
| `bg-app-main` | Main content background |
| `bg-app-sidebar` | Sidebar background |
| `bg-app-topbar` | Top bar background |
| `text-app-primary` | Primary text |
| `text-app-inverse` | Inverse text (for dark backgrounds) |
| `border-app-subtle` | Subtle borders |

**Do NOT use Tailwind `dark:` prefix** — it is not used in this codebase. The `.dark` class on `<html>` drives all theming via CSS variables.

### Modal / Overlay Pattern

Reference: `dispatch/src/components/EnvironmentPanel/EnvironmentPanel.tsx`

- Guard: `if (!open) return null;`
- Backdrop: `fixed inset-0 z-50 flex items-center justify-center bg-black/40`
- Card: `bg-app-main border border-app-subtle rounded-lg p-6`
- `stopPropagation` on card click to prevent backdrop dismissal
- No portal/createPortal — renders inline; Tauri WebView doesn't have z-index issues

### Testing Patterns

From `dispatch/src/components/TopBar/TopBar.test.tsx`:
- Uses `vi.hoisted()` for shared mock state
- `vi.mock('@/stores/uiSettingsStore', ...)` with both selector function and `getState` on the mock
- `vi.mock('@/lib/settings', ...)` returning `{ saveSetting: vi.fn().mockResolvedValue(undefined) }`
- Vitest + React Testing Library + JSDOM

Do NOT use `jest.*` — this project uses `vitest`. All test imports are from `vitest`.

### Project Structure Notes

- New component: `dispatch/src/components/Settings/SettingsPanel.tsx`
- New test: `dispatch/src/components/Settings/SettingsPanel.test.tsx`
- Modified: `dispatch/src/lib/db.ts`, `dispatch/src/lib/settings.ts`
- Modified: `dispatch/src/stores/uiSettingsStore.ts`
- Modified: `dispatch/src/hooks/useTheme.ts`
- Modified: `dispatch/src/components/Layout/AppShell.tsx`
- Modified: `dispatch/src-tauri/src/http.rs`
- Modified: `dispatch/src/components/MainPanel/MainPanel.tsx`
- Modified: `dispatch/src/components/TopBar/TopBar.tsx`
- The `dispatch/src/components/Settings/.gitkeep` file should be removed (git will do this automatically when `SettingsPanel.tsx` is added)

### References

- Settings DB seed: [docs](../../../dispatch/src-tauri/migrations/001_initial.sql) — `settings` table seeded with all 4 keys
- Modal pattern: [EnvironmentPanel.tsx](../../../dispatch/src/components/EnvironmentPanel/EnvironmentPanel.tsx)
- Store pattern: [uiSettingsStore.ts](../../../dispatch/src/stores/uiSettingsStore.ts)
- Theme hook: [useTheme.ts](../../../dispatch/src/hooks/useTheme.ts)
- Rust HTTP: [http.rs](../../../dispatch/src-tauri/src/http.rs) — `SendRequestPayload` and `send_request` fn
- Settings lib: [settings.ts](../../../dispatch/src/lib/settings.ts) — `loadAllSettings`, `saveSetting`
- TopBar: [TopBar.tsx](../../../dispatch/src/components/TopBar/TopBar.tsx)
- AppShell: [AppShell.tsx](../../../dispatch/src/components/Layout/AppShell.tsx)
- MainPanel send flow: [MainPanel.tsx](../../../dispatch/src/components/MainPanel/MainPanel.tsx#L227)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- Story context created: comprehensive developer guide with full codebase analysis
- Critical gap identified: Story 4.1 did not implement 'system' theme — Tasks 1–3 close this gap
- Rust `send_request` hardcoded 30s timeout and no SSL verify flag — Task 5 fixes this
- Frontend `SEND_TIMEOUT_MS = 15000` hardcoded — Task 6 replaces with dynamic store-driven value

### File List

# Story 4.1: Light/Dark Theme

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Dispatch user,
I want to choose between Light, Dark, and System (OS-follows) theme modes,
so that the app's visual appearance matches my preference and persists across restarts.

## Acceptance Criteria

1. Theme setting persists across restarts — read from and written to the SQLite `settings` table (`key = 'theme'`).
2. **System** mode follows the OS-level preference via `prefers-color-scheme` media query, updating dynamically if the OS theme changes at runtime.
3. Switching theme applies instantly without page reload (no flicker, no remount).
4. All components — TopBar, Sidebar, MainPanel (request builder, headers, body, auth, response panels), and modals — are correctly styled in both Light and Dark modes using the existing CSS custom property tokens.
5. Monaco Editor uses the matching theme: `"vs"` in light mode, `"vs-dark"` in dark mode.
6. A theme toggle is present in the TopBar (temporary placeholder UI — will be moved to Settings Panel in Story 4.3) to verify and demo all three modes.

## Tasks / Subtasks

- [x] Task 1 — Create `lib/settings.ts` (AC: 1)
  - [x] Create `dispatch/src/lib/settings.ts`
  - [x] Export `loadAllSettings(): Promise<AppSettings>` — reads all 4 keys from SQLite `settings` table, parsing each JSON-encoded value; returns default `AppSettings` object on failure
  - [x] Export `saveSetting(key: keyof AppSettings, value: AppSettings[keyof AppSettings]): Promise<void>` — serialises to JSON string (`JSON.stringify(value)`) and upserts via `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
  - [x] Use `getDb()` from `@/lib/db` — **do not** create a new `Database.load()` call
  - [x] Default values if DB read fails: `{ theme: 'system', request_timeout_ms: 30000, ssl_verify: true, editor_font_size: 14 }`

- [x] Task 2 — Extend `uiSettingsStore.ts` with theme state (AC: 1, 3)
  - [x] Open `dispatch/src/stores/uiSettingsStore.ts`
  - [x] Add `theme: 'light' | 'dark' | 'system'` to `UiSettingsState` interface
  - [x] Add `setTheme: (theme: 'light' | 'dark' | 'system') => void` to the interface
  - [x] Initialise `theme` with `'system'` as default (overridden at app startup from DB)
  - [x] Implement `setTheme` with `set({ theme })` — **do not** call `saveSetting` from inside the store action; persistence is triggered at the call site (in the toggle handler)
  - [x] **Do not** use Immer for this store — it currently uses plain Zustand `set`; keep pattern consistent

- [x] Task 3 — Create `useTheme` hook (AC: 2, 3, 4)
  - [x] Create `dispatch/src/hooks/useTheme.ts`
  - [x] Import `useUiSettingsStore` and `useEffect`
  - [x] Inside a `useEffect([theme])`, apply the `.dark` class to `document.documentElement`:
    - `theme === 'light'` → remove `.dark` class from `document.documentElement`
    - `theme === 'dark'` → add `.dark` class to `document.documentElement`
    - `theme === 'system'` → read `window.matchMedia('(prefers-color-scheme: dark)').matches`; add/remove `.dark` accordingly; attach a `change` event listener that re-evaluates; **clean up** the listener in the effect return callback
  - [x] Export the hook as `useTheme`
  - [x] The hook returns nothing — it is side-effect only

- [x] Task 4 — Bootstrap settings at app startup in `AppShell.tsx` (AC: 1, 2)
  - [x] Open `dispatch/src/components/Layout/AppShell.tsx`
  - [x] Import `loadAllSettings` from `@/lib/settings` and `useUiSettingsStore`
  - [x] In the existing `useEffect([], [])`, after `loadAllEnvironments`, load settings:
    ```ts
    loadAllSettings()
      .then((s) => {
        useUiSettingsStore.getState().setTheme(s.theme);
        useUiSettingsStore.getState().setEditorFontSize(s.editor_font_size);
      })
      .catch(() => {}); // defaults already set in store initial state
    ```
  - [x] Call `useTheme()` at the top of `AppShell` component body (hook subscribes to `theme` changes and mutates `document.documentElement`)
  - [x] **Do not** remove the existing environment-loading `useEffect` logic

- [x] Task 5 — Wire Monaco Editor theme (AC: 5)
  - [x] Open `dispatch/src/components/Editor/MonacoEditorField.tsx`
  - [x] Read `theme` from `useUiSettingsStore`
  - [x] Derive `monacoTheme`:
    - `theme === 'dark'` → `"vs-dark"`
    - `theme === 'system'` → `window.matchMedia('(prefers-color-scheme: dark)').matches ? "vs-dark" : "vs"`
    - `theme === 'light'` → `"vs"`
  - [x] Pass `monacoTheme` as the `theme` prop to the `<Editor>` component from `@monaco-editor/react`
  - [x] The Monaco theme must **re-evaluate** when `theme` store value changes — React's reactivity via `useUiSettingsStore` subscriber handles this automatically

- [x] Task 6 — Add theme toggle to TopBar (AC: 6)
  - [x] Open `dispatch/src/components/TopBar/TopBar.tsx`
  - [x] Import `useUiSettingsStore` and `saveSetting` from `@/lib/settings`
  - [x] Read `theme` from store: `const theme = useUiSettingsStore((s) => s.theme)`
  - [x] Add `handleThemeChange` async function that cycles `none → light → dark → system → light`:
    ```ts
    async function handleThemeChange() {
      const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
      useUiSettingsStore.getState().setTheme(next);
      await saveSetting('theme', next);
    }
    ```
  - [ ] Add a small icon button to the right of the gear icon (⚙) in the TopBar JSX:
    ```tsx
    <button
      aria-label="Toggle theme"
      className="text-xs text-app-inverse border border-white/20 rounded px-2 py-1 hover:bg-white/10"
      onClick={() => void handleThemeChange()}
    >
      {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️'}
    </button>
    ```
  - [x] Place this button **before** the existing `⚙` environment button so the order is: theme toggle | env selector | env settings

- [x] Task 7 — Tests (AC: 1–6)
  - [x] Create `dispatch/src/lib/settings.test.ts`:
    - Mock `@/lib/db` (mock `getDb` returning a fake DB object with `select` and `execute`)
    - Test `loadAllSettings`: parses all 4 JSON-serialised values correctly
    - Test `loadAllSettings`: returns defaults when DB throws
    - Test `saveSetting`: calls correct SQL with `JSON.stringify(value)`
  - [x] Create `dispatch/src/hooks/useTheme.test.ts`:
    - Test: `theme === 'light'` removes `.dark` from `document.documentElement.classList`
    - Test: `theme === 'dark'` adds `.dark` to `document.documentElement.classList`
    - Test: `theme === 'system'` adds `.dark` when media query matches dark; removes when light
    - Test: `theme === 'system'` cleans up media query listener on unmount
  - [x] Extend `dispatch/src/stores/uiSettingsStore.test.ts` (or create if not present):
    - Test: `setTheme` updates `theme` in store
    - Test: initial `theme` value is `'system'`
  - [x] Extend `dispatch/src/components/TopBar/TopBar.test.tsx`:
    - Test: theme toggle button renders with correct accessible label
    - Test: clicking theme toggle cycles `light → dark → system → light`

- [x] Task 8 — Quality gates
  - [x] Run `yarn typecheck` from `dispatch/` — no TypeScript errors
  - [x] Run `yarn test` from `dispatch/` — all tests pass

- [x] Final Task — Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 4.1

## Dev Notes

### Story Foundation

Story 4.1 is the **first story in Epic 4** (Polish & Packaging). It is a prerequisite for:
- **Story 4.3 (Settings Panel)**: will move the theme toggle into the full settings modal and add request timeout, SSL verify, and font size controls
- **Story 4.4 (App Packaging)**: no direct dependency, but a polished app needs theming sorted first

### CSS Architecture — Already Complete

The `index.css` already defines two complete CSS custom property palettes:

- **Light** (`:root`): `--app-surface-main: #ffffff`, `--app-surface-sidebar: #1f2937`, etc.
- **Dark** (`.dark`): `--app-surface-main: #111827`, `--app-surface-sidebar: #030712`, etc.

The utility classes (`text-app-primary`, `bg-app-main`, `bg-app-sidebar`, `bg-app-topbar`, `border-app-subtle`) all resolve via these CSS variables — so **adding `.dark` to `<html>` is all that is needed to flip the entire app into dark mode**. No component-level changes required.

**Tailwind v4 note**: This project uses Tailwind v4 via `@tailwindcss/vite`. Do NOT create or modify `tailwind.config.js`. The `.dark {}` block in `index.css` already handles dark mode at the CSS-variables layer. The `dark:` Tailwind prefix is NOT used in this codebase — do not introduce it.

### SQLite Settings Table — Already Seeded

From `migrations/001_initial.sql`, the `settings` table is already created and seeded:

```sql
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('theme', '"system"'),
  ('request_timeout_ms', '30000'),
  ('ssl_verify', 'true'),
  ('editor_font_size', '14');
```

Values are **JSON-serialised strings**: `'"system"'` is a JSON string `"system"`, `'30000'` is a JSON number. Use `JSON.parse(row.value)` to read and `JSON.stringify(value)` to write. The `AppSettings` interface in `lib/db.ts` already models the full settings shape:

```typescript
export interface AppSettings {
    theme: 'light' | 'dark' | 'system';
    request_timeout_ms: number;
    ssl_verify: boolean;
    editor_font_size: number;
}
```

### `uiSettingsStore.ts` — Current State

The existing store only holds `editorFontSize`:

```typescript
interface UiSettingsState {
    editorFontSize: number;
    setEditorFontSize: (fontSize: number) => void;
}
```

Add `theme` to this store. Do **not** create a separate `themeStore.ts`. Story 4.3 will further extend this store with `requestTimeoutMs` and `sslVerify`.

### `useTheme` Hook Pattern

The hook must handle the media-query listener cleanup to avoid memory leaks. The correct pattern:

```typescript
import { useEffect } from 'react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

export function useTheme() {
    const theme = useUiSettingsStore((s) => s.theme);

    useEffect(() => {
        const html = document.documentElement;

        if (theme === 'light') {
            html.classList.remove('dark');
            return;
        }

        if (theme === 'dark') {
            html.classList.add('dark');
            return;
        }

        // System mode
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = (e: MediaQueryListEvent | MediaQueryList) => {
            html.classList.toggle('dark', e.matches);
        };
        apply(mq); // Apply immediately
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, [theme]);
}
```

### Monaco Editor Theme

`@monaco-editor/react` accepts a `theme` prop. The project currently uses `MonacoEditorField` in `dispatch/src/components/Editor/MonacoEditorField.tsx`. Pass the derived theme string — **not** the store's raw `'light'|'dark'|'system'` value — as `"vs"` or `"vs-dark"`.

For `system` mode, read `window.matchMedia` at render time. This is sufficient — when the OS theme changes, the `useTheme` hook updates the store, React re-renders the component, and Monaco receives the new `theme` prop.

### TopBar Toggle — Temporary UI

The theme toggle button in TopBar is a **temporary placeholder**. Story 4.3 integrates it into the full Settings Panel modal. When Story 4.3 is implemented, the toggle button in TopBar should be removed and replaced by the `⚙` settings gear opening the Settings Panel.

### `lib/settings.ts` Query Pattern

Use `getDb()` singleton. The settings table read pattern:

```typescript
import { getDb, AppSettings } from '@/lib/db';

type SettingsRow = { key: string; value: string };

export async function loadAllSettings(): Promise<AppSettings> {
    try {
        const db = await getDb();
        const rows = await db.select<SettingsRow[]>('SELECT key, value FROM settings');
        const map = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
        return {
            theme: map['theme'] ?? 'system',
            request_timeout_ms: map['request_timeout_ms'] ?? 30000,
            ssl_verify: map['ssl_verify'] ?? true,
            editor_font_size: map['editor_font_size'] ?? 14,
        };
    } catch {
        return { theme: 'system', request_timeout_ms: 30000, ssl_verify: true, editor_font_size: 14 };
    }
}

export async function saveSetting(
    key: keyof AppSettings,
    value: AppSettings[keyof AppSettings]
): Promise<void> {
    const db = await getDb();
    await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        key,
        JSON.stringify(value),
    ]);
}
```

### Project Structure Notes

- New file: `dispatch/src/lib/settings.ts`
- New file: `dispatch/src/hooks/useTheme.ts`
- Modified: `dispatch/src/stores/uiSettingsStore.ts` (add `theme` + `setTheme`)
- Modified: `dispatch/src/components/Layout/AppShell.tsx` (bootstrap settings + call `useTheme`)
- Modified: `dispatch/src/components/Editor/MonacoEditorField.tsx` (pass Monaco theme prop)
- Modified: `dispatch/src/components/TopBar/TopBar.tsx` (add theme toggle button)
- New tests: `dispatch/src/lib/settings.test.ts`, `dispatch/src/hooks/useTheme.test.ts`

### References

- CSS custom properties: [src/index.css](dispatch/src/index.css#L1)
- `AppSettings` interface: [src/lib/db.ts](dispatch/src/lib/db.ts) — `theme: 'light' | 'dark' | 'system'`
- SQLite settings seed: [src-tauri/migrations/001_initial.sql](dispatch/src-tauri/migrations/001_initial.sql)
- Existing `uiSettingsStore`: [src/stores/uiSettingsStore.ts](dispatch/src/stores/uiSettingsStore.ts)
- Monaco component: [src/components/Editor/MonacoEditorField.tsx](dispatch/src/components/Editor/MonacoEditorField.tsx)
- TopBar component: [src/components/TopBar/TopBar.tsx](dispatch/src/components/TopBar/TopBar.tsx)
- AppShell (bootstrap): [src/components/Layout/AppShell.tsx](dispatch/src/components/Layout/AppShell.tsx)
- Previous story pattern (store extension): [Story 3.3](4-3-auth-types.md) — `setAuth` added to `requestStore.ts`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- Added `window.matchMedia` stub to `dispatch/src/test/setup.ts` — jsdom does not implement this API; `MonacoEditorField` reads it at render time (system mode), and `useTheme` reads it in a `useEffect`. Both `AppShell.test.tsx`, `ResponseViewer.test.tsx`, and `MainPanel.test.tsx` were failing without the global stub.

### Completion Notes List

- Created `dispatch/src/lib/settings.ts` with `loadAllSettings` (reads all 4 settings from SQLite, JSON-parses each, returns defaults on failure) and `saveSetting` (upserts JSON-serialised value).
- Extended `dispatch/src/stores/uiSettingsStore.ts` — added `theme: 'light' | 'dark' | 'system'` (default `'system'`) and `setTheme` action using plain Zustand `set`.
- Created `dispatch/src/hooks/useTheme.ts` — side-effect-only hook that adds/removes `.dark` on `document.documentElement` based on store theme; for `system` mode, wires a `matchMedia` change listener with proper cleanup.
- Modified `dispatch/src/components/Layout/AppShell.tsx` — calls `useTheme()` at component top, and bootstraps settings from DB in the existing `useEffect`.
- Modified `dispatch/src/components/Editor/MonacoEditorField.tsx` — derives `monacoTheme` (`"vs"` / `"vs-dark"`) from `useUiSettingsStore`; system mode reads `window.matchMedia` at render time.
- Modified `dispatch/src/components/TopBar/TopBar.tsx` — added theme toggle button (cycles system→light→dark→system, persists via `saveSetting`), placed before env selector.
- 28 new tests pass across 4 test files. Full suite: 229/229 tests, 24/24 files passing. TypeScript: clean.

### File List

- dispatch/src/lib/settings.ts (new)
- dispatch/src/lib/settings.test.ts (new)
- dispatch/src/hooks/useTheme.ts (new)
- dispatch/src/hooks/useTheme.test.ts (new)
- dispatch/src/stores/uiSettingsStore.ts (modified)
- dispatch/src/stores/uiSettingsStore.test.ts (new)
- dispatch/src/components/Layout/AppShell.tsx (modified)
- dispatch/src/components/Editor/MonacoEditorField.tsx (modified)
- dispatch/src/components/TopBar/TopBar.tsx (modified)
- dispatch/src/components/TopBar/TopBar.test.tsx (modified)
- dispatch/src/test/setup.ts (modified)

## Change Log

- Story 4.1 implemented — light/dark/system theme with persistence, `useTheme` hook, Monaco theme wiring, TopBar toggle (Date: 2026-03-10)

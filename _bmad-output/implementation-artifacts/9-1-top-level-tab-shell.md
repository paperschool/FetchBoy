# Story 9.1: Top-Level Tab Shell

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Fetch Boy user,
I want a top-level tab bar that lets me switch between the HTTP client and a future Intercept view,
so that the app can grow to support traffic interception without disrupting the existing client workflow.

## Acceptance Criteria

1. App root renders a top-level tab bar with exactly two tabs: "Client" and "Intercept"
2. "Client" tab renders the entire existing app interface pixel-for-pixel unchanged (AppShell, TourController, modals all work as before)
3. "Intercept" tab renders a placeholder / empty state ready for Story 9.2
4. Active tab is tracked in a new `useAppTabStore` Zustand store (no immer needed — simple state)
5. Top-level tab shell component (`AppTabs.tsx`) is ≤150 lines
6. Styling uses existing Tailwind custom tokens (`bg-app-main`, `text-app-primary`, etc.) — NO shadcn/ui Tabs component required
7. No regressions: all existing keyboard shortcuts, modals, tour flow, and request functionality work correctly on the Client tab
8. Global modals (`KeyboardShortcutsModal`, `WhatsNewModal`) remain rendered at App.tsx level, outside the tab shell, so they overlay both tabs

## Tasks / Subtasks

- [x] Task 1 — Create `useAppTabStore` (AC: #4)
  - [x] Create `src/stores/appTabStore.ts`
  - [x] Store shape: `{ activeTab: 'client' | 'intercept'; setActiveTab: (tab) => void }`
  - [x] Use `create` from zustand — no immer needed (simple string update)
  - [x] No persistence — tabs reset to 'client' on app launch
- [x] Task 2 — Create placeholder `InterceptView` (AC: #3)
  - [x] Create `src/components/Intercept/InterceptView.tsx`
  - [x] Render a centered empty state: icon + "Traffic Intercept" heading + "Start the proxy to see requests here." subtext
  - [x] Use existing `EmptyState` component from `src/components/ui/EmptyState.tsx` if suitable, else hand-code with Tailwind
  - [x] Component must be ≤150 lines (will be trivially small)
- [x] Task 3 — Create `AppTabs` shell component (AC: #1, #2, #5, #6, #8)
  - [x] Create `src/components/AppTabs/AppTabs.tsx`
  - [x] Read `useAppTabStore` for active tab state
  - [x] Render a styled tab bar at the top with "Client" and "Intercept" buttons
  - [x] Render the active panel below; use CSS `hidden`/`block` (or conditional rendering) to show/hide panels
  - [x] **IMPORTANT: Use CSS visibility toggling (`hidden` class) for the "Client" tab content — do NOT unmount it** (unmounting causes TourController/AppShell state loss and breaks keyboard shortcut registration)
  - [x] Apply active tab indicator using Tailwind (border-bottom highlight using `border-app-primary` or similar)
  - [x] Keep component ≤150 lines
- [x] Task 4 — Wire into App.tsx (AC: #2, #7, #8)
  - [x] Modify `src/App.tsx` to import and render `<AppTabs>` wrapping the existing TourController + AppShell content
  - [x] `KeyboardShortcutsModal` and `WhatsNewModal` stay in `App.tsx` OUTSIDE of `<AppTabs>` so they overlay both tabs
  - [x] `SplashScreen` logic stays at App.tsx level (unchanged)
  - [x] App.tsx must remain ≤150 lines after changes (it was 95 lines — adding ~10-15 lines is fine)
- [x] Final Task — Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 9.1

## Dev Notes

### Critical Implementation Note: Do NOT Unmount the Client Tab

The existing app has side-effects that run in `AppShell`, `TourController`, and keyboard shortcut hooks on mount. **If the "Client" tab content is unmounted when switching to Intercept, these effects re-run on remount** — breaking the tour, re-seeding sample data checks, re-registering shortcuts, etc.

**Required approach: visibility toggling**
```tsx
// AppTabs.tsx — use className hide/show, NOT conditional rendering
<div className={activeTab === 'client' ? 'block' : 'hidden'}>
  {children.client}
</div>
<div className={activeTab === 'intercept' ? 'block' : 'hidden'}>
  <InterceptView />
</div>
```

This keeps the Client DOM mounted and all React effects active regardless of which top-level tab is selected.

### App.tsx Current Structure (95 lines)

```tsx
// src/App.tsx — CURRENT
function App() {
  // DB init, splash, version tracking, tour, sample data seeding...
  return (
    <>
      {showSplash && <SplashScreen onComplete={...} />}
      {!showSplash && (
        <TourController>
          <AppShell />
        </TourController>
      )}
      <KeyboardShortcutsModal ... />
      <WhatsNewModal ... />
    </>
  )
}
```

**Target structure after Story 9.1:**

```tsx
// src/App.tsx — AFTER
function App() {
  // DB init, splash, version tracking, tour, sample data seeding... (UNCHANGED)
  return (
    <>
      {showSplash && <SplashScreen onComplete={...} />}
      {!showSplash && (
        <AppTabs>
          <TourController>
            <AppShell />
          </TourController>
        </AppTabs>
      )}
      <KeyboardShortcutsModal ... />   {/* stays outside AppTabs */}
      <WhatsNewModal ... />            {/* stays outside AppTabs */}
    </>
  )
}
```

### Store Pattern to Follow

All stores in this codebase use this pattern:

```ts
// src/stores/appTabStore.ts — new store
import { create } from 'zustand'

type AppTab = 'client' | 'intercept'

interface AppTabStore {
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void
}

export const useAppTabStore = create<AppTabStore>((set) => ({
  activeTab: 'client',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
```

No immer needed — this is a simple string field. Compare with `uiSettingsStore.ts` which also uses `create` (no immer) for simple settings state.

### Tab Bar Styling Guidance

The app uses custom CSS tokens via Tailwind v4. From `src/index.css`, the key tokens for UI chrome are:

- **Background**: `bg-app-main` (main content area), `bg-app-sidebar` (sidebar)
- **Text**: `text-app-primary`, `text-app-secondary`, `text-app-muted`
- **Borders**: `border-app-subtle`
- **Accent/Active**: Look at TabBar.tsx for the active tab indicator pattern

The existing request TabBar (`src/components/TabBar/TabBar.tsx`) is a 310-line sortable drag-and-drop implementation — **do NOT reuse it** for top-level navigation. The top-level tabs are simple, non-sortable navigation tabs.

A minimal custom tab bar example:

```tsx
// Simple top-level navigation tab bar — NOT the dnd-kit TabBar
function TopNavTabs({ activeTab, onSelect }: { activeTab: AppTab; onSelect: (t: AppTab) => void }) {
  return (
    <div className="flex border-b border-app-subtle bg-app-main px-2">
      {(['client', 'intercept'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => onSelect(tab)}
          className={`px-4 py-2 text-sm font-medium capitalize transition-colors
            ${activeTab === tab
              ? 'border-b-2 border-blue-500 text-app-primary'
              : 'text-app-muted hover:text-app-secondary'
            }`}
        >
          {tab === 'client' ? 'Client' : 'Intercept'}
        </button>
      ))}
    </div>
  )
}
```

Adjust token names to match what `index.css` actually defines — check for the active tab highlight pattern in the existing UI.

### New Files to Create

| File | Purpose | Size Limit |
|------|---------|-----------|
| `src/stores/appTabStore.ts` | Top-level tab state | ~20 lines |
| `src/components/AppTabs/AppTabs.tsx` | Tab shell component | ≤150 lines |
| `src/components/Intercept/InterceptView.tsx` | Placeholder intercept view | ≤50 lines |

### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `src/App.tsx` (95 lines) | Wrap TourController+AppShell in `<AppTabs>` | Low — additive |

### Project Structure Notes

- New store: `src/stores/appTabStore.ts` — follows exact same pattern as `uiSettingsStore.ts`
- New component dir: `src/components/AppTabs/` — follows existing per-component directory convention
- New component dir: `src/components/Intercept/` — new home for all intercept-related components (9.2, 9.4 will add files here)
- No database changes, no Rust changes, no Cargo.toml changes for this story

### Testing Standards

- Tests are co-located: `src/components/AppTabs/AppTabs.test.tsx`
- Framework: Vitest + React Testing Library (see `src/test/` for setup)
- Minimum test cases:
  - Renders "Client" and "Intercept" tabs
  - Clicking "Intercept" tab shows InterceptView placeholder
  - Clicking "Client" tab shows client content
  - Client content is in the DOM (not removed) when Intercept tab is active

### References

- App.tsx current structure: `src/App.tsx` (95 lines)
- Store pattern reference: `src/stores/uiSettingsStore.ts` (simple create, no immer)
- Immer store pattern reference: `src/stores/tabStore.ts` (complex state — not needed here)
- Existing TabBar (do NOT reuse): `src/components/TabBar/TabBar.tsx` (310 lines, dnd-kit)
- AppShell layout: `src/components/Layout/AppShell.tsx` (61 lines)
- EmptyState component: `src/components/ui/EmptyState.tsx`
- CSS tokens: `src/index.css` (3317 lines — search for `--app-` custom properties)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — clean implementation, no blockers.

### Completion Notes List

- Created `useAppTabStore` following exact `uiSettingsStore.ts` pattern (create, no immer, no persistence).
- `InterceptView` hand-coded with Tailwind (Shield icon, heading, subtext) since EmptyState lacks a heading+subtext split.
- `AppTabs` uses CSS `hidden`/`block` visibility toggling (NOT conditional rendering) to keep client DOM mounted — preserves TourController, AppShell effects, and keyboard shortcut registration.
- `AppShell` `h-screen` changed to `h-full` so it fills the flex content area inside AppTabs correctly (layout fix; AppShell tests pass, no regressions).
- `App.tsx` is 101 lines (well under ≤150 limit). Global modals remain outside `<AppTabs>` per AC #8.
- 6 new tests in `AppTabs.test.tsx` — all pass. Full suite: 555/557 pass (2 pre-existing failures in `seedSampleData.test.ts` unrelated to this story).

### File List

- `src/stores/appTabStore.ts` (new)
- `src/components/Intercept/InterceptView.tsx` (new)
- `src/components/AppTabs/AppTabs.tsx` (new)
- `src/components/AppTabs/AppTabs.test.tsx` (new)
- `src/App.tsx` (modified)
- `src/components/Layout/AppShell.tsx` (modified — h-screen → h-full)
- `_bmad-output/implementation-artifacts/9-1-top-level-tab-shell.md` (story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status updated)

## Change Log

- 2026-03-12: Story 9.1 implemented — top-level tab shell with Client/Intercept navigation, useAppTabStore, InterceptView placeholder, and AppTabs component wired into App.tsx.

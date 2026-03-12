# Story 8.3: SettingsPanel & AuthPanel Refactoring

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer maintaining FetchBoy,
I want SettingsPanel.tsx and AuthPanel.tsx to comply with code styling standards (≤150 lines),
so that the codebase remains maintainable and follows project conventions.

## Acceptance Criteria

1. SettingsPanel.tsx reduced from 187 lines to ≤150 lines
2. AuthPanel.tsx reduced/optimized while maintaining functionality (currently 135 lines)
3. SettingsPanel broken into category-specific sub-components
4. AuthPanel auth-type specific components extracted
5. All existing functionality preserved and tested
6. No regressions in settings or auth flow
7. Run `npx tsc --noEmit` and `cargo check` with no errors

## Tasks / Subtasks

### SettingsPanel Refactoring

- [ ] Task 1 - Extract SettingsSection sub-components (AC: 1, 3)
  - [ ] Create `fetch-boy/src/components/Settings/components/ThemeSettings.tsx` - Theme selection
  - [ ] Create `fetch-boy/src/components/Settings/components/RequestSettings.tsx` - Timeout, SSL verify
  - [ ] Create `fetch-boy/src/components/Settings/components/EditorSettings.tsx` - Font size controls
  - [ ] Create `fetch-boy/src/components/Settings/components/TutorialSettings.tsx` - Restart tutorial

- [ ] Task 2 - Extract KeyboardShortcuts component (AC: 3)
  - [ ] Create `fetch-boy/src/components/Settings/components/KeyboardShortcuts.tsx` - Shortcuts display

- [ ] Task 3 - Refactor SettingsPanel.tsx to compose children (AC: 1, 3)
  - [ ] Import and render all settings sections
  - [ ] Ensure total lines ≤150

### AuthPanel Refactoring

- [ ] Task 4 - Extract auth type specific components (AC: 2, 4)
  - [ ] Create `fetch-boy/src/components/AuthPanel/components/BearerAuth.tsx` - Bearer token input
  - [ ] Create `fetch-boy/src/components/AuthPanel/components/BasicAuth.tsx` - Username/password
  - [ ] Create `fetch-boy/src/components/AuthPanel/components/ApiKeyAuth.tsx` - API key inputs

- [ ] Task 5 - Refactor AuthPanel.tsx to compose children (AC: 2)
  - [ ] Import and render auth type components based on selection
  - [ ] Keep auth type selector in main component

### Final

- [ ] Task 6 - Final Task - Commit story changes
  - [ ] Run `npx tsc --noEmit` from `fetch-boy/` to verify TypeScript compilation
  - [ ] Run `cargo check` from `fetch-boy/src-tauri/` to verify Rust compilation
  - [ ] Run `npx vitest run` from `fetch-boy/` to verify all tests pass
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 8.3

## Dev Notes

### Current Files Analysis

**SettingsPanel.tsx:**
- Current Lines: 187
- Target: ≤150 lines
- Contains: Theme, timeout, SSL, font size, tutorial restart, keyboard shortcuts

**AuthPanel.tsx:**
- Current Lines: 135
- Target: Already under 150 but should be broken down for consistency
- Contains: Auth type selector, Bearer, Basic, API Key inputs

### Proposed File Structure After Refactoring

**SettingsPanel:**
```
fetch-boy/src/components/Settings/
├── SettingsPanel.tsx              # Main component (~120 lines)
├── index.ts                       # Barrel export
└── components/
    ├── ThemeSettings.tsx         # NEW - Theme radio buttons
    ├── RequestSettings.tsx       # NEW - Timeout and SSL
    ├── EditorSettings.tsx        # NEW - Font size controls
    ├── TutorialSettings.tsx      # NEW - Restart tutorial button
    └── KeyboardShortcuts.tsx     # NEW - Shortcuts display
```

**AuthPanel:**
```
fetch-boy/src/components/AuthPanel/
├── AuthPanel.tsx                 # Main component (~60 lines)
├── index.ts                      # Barrel export
└── components/
    ├── BearerAuth.tsx           # NEW - Bearer token input
    ├── BasicAuth.tsx            # NEW - Username/password inputs
    └── ApiKeyAuth.tsx           # NEW - API key inputs
```

### Critical Implementation Details

**1. SettingsPanel - ThemeSettings.tsx:**

```typescript
// components/ThemeSettings.tsx
interface ThemeSettingsProps {
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (value: 'light' | 'dark' | 'system') => void;
}

export function ThemeSettings({ theme, onThemeChange }: ThemeSettingsProps) {
  return (
    <div className="space-y-2">
      <p className="text-app-primary text-sm font-medium">Theme</p>
      <div className="flex gap-4">
        {(['light', 'dark', 'system'] as const).map((option) => (
          <label key={option} className="flex items-center gap-1.5 text-app-primary text-sm cursor-pointer">
            <input
              type="radio"
              name="theme"
              value={option}
              checked={theme === option}
              onChange={() => onThemeChange(option)}
            />
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </label>
        ))}
      </div>
    </div>
  );
}
```

**2. SettingsPanel - KeyboardShortcuts.tsx:**

```typescript
// components/KeyboardShortcuts.tsx
import { KEYBOARD_SHORTCUTS, getShortcutDisplay } from '@/lib/keyboardShortcuts';

interface KeyboardShortcutsProps {
  isMac: boolean;
}

export function KeyboardShortcuts({ isMac }: KeyboardShortcutsProps) {
  return (
    <div className="space-y-2">
      <p className="text-app-primary text-sm font-medium">Keyboard Shortcuts</p>
      <dl className="space-y-1 text-sm">
        {KEYBOARD_SHORTCUTS.map((shortcut) => (
          <div key={shortcut.id} className="flex justify-between">
            <dt className="text-app-secondary">{shortcut.displayName}</dt>
            <dd className="text-app-primary font-mono text-xs">
              {getShortcutDisplay(isMac, shortcut)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

**3. AuthPanel - BearerAuth.tsx:**

```typescript
// components/BearerAuth.tsx
interface BearerAuthProps {
  token: string;
  onChange: (token: string) => void;
}

export function BearerAuth({ token, onChange }: BearerAuthProps) {
  return (
    <div>
      <label htmlFor="auth-bearer-token" className="text-app-secondary mb-1 block text-xs font-medium">
        Token
      </label>
      <input
        id="auth-bearer-token"
        type="text"
        value={token}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter bearer token"
        className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm"
      />
    </div>
  );
}
```

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Tailwind CSS v4 with dark mode
- Zustand for state management
- Vitest + React Testing Library for tests

**Component Pattern:**
- Follow existing component patterns in `fetch-boy/src/components/`
- Use barrel exports in `index.ts`
- Keep props interfaces with components

### Integration Points

**New Files (Settings):**
- `fetch-boy/src/components/Settings/components/ThemeSettings.tsx`
- `fetch-boy/src/components/Settings/components/RequestSettings.tsx`
- `fetch-boy/src/components/Settings/components/EditorSettings.tsx`
- `fetch-boy/src/components/Settings/components/TutorialSettings.tsx`
- `fetch-boy/src/components/Settings/components/KeyboardShortcuts.tsx`

**New Files (Auth):**
- `fetch-boy/src/components/AuthPanel/components/BearerAuth.tsx`
- `fetch-boy/src/components/AuthPanel/components/BasicAuth.tsx`
- `fetch-boy/src/components/AuthPanel/components/ApiKeyAuth.tsx`

**Modified Files:**
- `fetch-boy/src/components/Settings/SettingsPanel.tsx` - Refactored
- `fetch-boy/src/components/AuthPanel/AuthPanel.tsx` - Refactored

### Critical Implementation Guardrails

1. **SettingsPanel:**
   - Preserve all settings: theme, timeout, SSL, font size, tutorial, shortcuts
   - Maintain modal overlay behavior
   - Keep saveSetting calls in appropriate places

2. **AuthPanel:**
   - Preserve all auth types: none, bearer, basic, api-key
   - Maintain form state management
   - Handle all auth config transitions

### Testing Requirements

**Unit Tests:**

1. Test each Settings sub-component renders correctly
2. Test each Auth sub-component renders correctly
3. Test keyboard shortcut display for Mac/Windows

**Integration Tests:**

1. Test Settings panel opens/closes correctly
2. Test all settings changes persist
3. Test auth type switching preserves data

### References

- **Code Styling Standards**: `_bmad/_memory/tech-writer-sidecar/code-styling-standards.md` (Component Size Limits section)
- **Component Refactoring Pattern**: Same file (Component Design Principles > Breaking Down Large Components)
- **Previous Stories**: 8-1-mainpanel-refactoring.md, 8-2-responseviewer-refactoring.md

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

- Workflow: create-story (Story 8.3)
- Epic: 8 - Code Quality & Styling Compliance
- Source: `_bmad-output/code-styling-audit-report.md`
- Current SettingsPanel.tsx: 187 lines
- Current AuthPanel.tsx: 135 lines
- Target SettingsPanel: ≤150 lines

### Completion Notes List

### File List

- fetch-boy/src/components/Settings/components/ThemeSettings.tsx (new)
- fetch-boy/src/components/Settings/components/RequestSettings.tsx (new)
- fetch-boy/src/components/Settings/components/EditorSettings.tsx (new)
- fetch-boy/src/components/Settings/components/TutorialSettings.tsx (new)
- fetch-boy/src/components/Settings/components/KeyboardShortcuts.tsx (new)
- fetch-boy/src/components/Settings/SettingsPanel.tsx (modified)
- fetch-boy/src/components/AuthPanel/components/BearerAuth.tsx (new)
- fetch-boy/src/components/AuthPanel/components/BasicAuth.tsx (new)
- fetch-boy/src/components/AuthPanel/components/ApiKeyAuth.tsx (new)
- fetch-boy/src/components/AuthPanel/AuthPanel.tsx (modified)

## Change Log

- 2026-03-12: Story 8.3 created — SettingsPanel & AuthPanel Refactoring

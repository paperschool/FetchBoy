# Story 7.5: Keyboard Shortcut Overlay

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to press `?` to see all keyboard shortcuts,
So that I can discover and learn the app's power features without reading docs.

## Acceptance Criteria

1. Pressing `?` when not focused in an input opens a modal listing all keyboard shortcuts grouped by category
2. Modal closes on `Escape` or click-outside
3. Shortcuts are sourced from a single constants file (no duplication)

## Tasks / Subtasks

- [x] Task 1 - Create keyboard shortcuts constants file (AC: 3)
  - [x] Create `fetch-boy/src/lib/keyboardShortcuts.ts`
  - [x] Define all shortcuts with: key, displayName, category, macKeys, windowsKeys
  - [x] Export typed constants for use across the app

- [x] Task 2 - Create KeyboardShortcutsModal component (AC: 1, 2)
  - [x] Create `fetch-boy/src/components/ui/KeyboardShortcutsModal.tsx`
  - [x] Accept `open: boolean` and `onClose: () => void` props
  - [x] Group shortcuts by category (General, Request, Tabs)
  - [x] Support theme-aware styling (light/dark mode)
  - [x] Add keyboard listener for Escape key
  - [x] Include test file

- [x] Task 3 - Add global `?` keyboard shortcut listener (AC: 1)
  - [x] Add useEffect in App.tsx to listen for `?` keypress
  - [x] Only trigger when NOT focused in an input/textarea
  - [x] Open KeyboardShortcutsModal when `?` pressed

- [x] Task 4 - Update SettingsPanel to use constants (AC: 3)
  - [x] Import shortcuts from keyboardShortcuts.ts
  - [x] Replace hardcoded shortcut display with constants
  - [x] Ensure consistency between modal and settings

- [x] Task 5 - Update SettingsAccordion to use constants (AC: 3)
  - [x] Import shortcuts from keyboardShortcuts.ts
  - [x] Replace hardcoded shortcut display with constants

- [x] Task 6 - Final Task - Commit story changes
  - [x] Run `npx tsc --noEmit` from `fetch-boy/` to verify TypeScript compilation
  - [x] Run `npx vitest run` from `fetch-boy/` to verify all tests pass
  - [x] Commit all code and documentation changes for this story with a message that includes Story 7.5

## Dev Notes

### Critical Implementation Details

**Keyboard Shortcuts Constants File:**

Create a new file at `fetch-boy/src/lib/keyboardShortcuts.ts`:

```typescript
export interface KeyboardShortcut {
  id: string;
  displayName: string;
  category: 'general' | 'request' | 'tabs';
  macKeys: string;
  windowsKeys: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    id: 'send-request',
    displayName: 'Send Request',
    category: 'request',
    macKeys: '⌘+Enter',
    windowsKeys: 'Ctrl+Enter',
  },
  {
    id: 'toggle-sidebar',
    displayName: 'Toggle Sidebar',
    category: 'general',
    macKeys: '⌘+B',
    windowsKeys: 'Ctrl+B',
  },
  {
    id: 'new-tab',
    displayName: 'New Tab',
    category: 'tabs',
    macKeys: '⌘+T',
    windowsKeys: 'Ctrl+T',
  },
  {
    id: 'close-tab',
    displayName: 'Close Tab',
    category: 'tabs',
    macKeys: '⌘+W',
    windowsKeys: 'Ctrl+W',
  },
  {
    id: 'next-tab',
    displayName: 'Next Tab',
    category: 'tabs',
    macKeys: '⌘+Tab',
    windowsKeys: 'Ctrl+Tab',
  },
];

export function getShortcutDisplay(isMac: boolean, shortcut: KeyboardShortcut): string {
  return isMac ? shortcut.macKeys : shortcut.windowsKeys;
}
```

**KeyboardShortcutsModal Component:**

Create at `fetch-boy/src/components/ui/KeyboardShortcutsModal.tsx`:

```typescript
import { X } from 'lucide-react';
import { KEYBOARD_SHORTCUTS, KeyboardShortcut } from '@/lib/keyboardShortcuts';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const theme = useUiSettingsStore((s) => s.theme);
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const grouped = KEYBOARD_SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  const categoryLabels = {
    general: 'General',
    request: 'Request',
    tabs: 'Tabs',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      data-testid="keyboard-shortcuts-overlay"
    >
      <div
        className={`bg-app-main border border-app-subtle rounded-lg p-6 w-[420px] shadow-xl max-h-[80vh] overflow-y-auto ${isDark ? 'dark' : ''}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="keyboard-shortcuts-modal"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-app-primary font-semibold text-lg">Keyboard Shortcuts</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-app-primary opacity-60 hover:opacity-100"
          >
            <X size={20} />
          </button>
        </div>

        {Object.entries(grouped).map(([category, shortcuts]) => (
          <div key={category} className="mb-6 last:mb-0">
            <h3 className="text-app-secondary text-sm font-medium mb-3 uppercase tracking-wide">
              {categoryLabels[category as keyof typeof categoryLabels]}
            </h3>
            <dl className="space-y-2">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.id} className="flex justify-between items-center">
                  <dt className="text-app-primary text-sm">{shortcut.displayName}</dt>
                  <dd className="text-app-muted font-mono text-xs bg-app-subtle px-2 py-1 rounded">
                    {shortcut.macKeys} / {shortcut.windowsKeys}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}

        <div className="mt-6 pt-4 border-t border-app-subtle text-center">
          <p className="text-app-muted text-xs">Press <kbd className="bg-app-subtle px-1.5 py-0.5 rounded text-app-primary">?</kbd> anytime to show this overlay</p>
        </div>
      </div>
    </div>
  );
}
```

**Global `?` Keyboard Listener in App.tsx:**

In `fetch-boy/src/App.tsx`, add state for modal visibility and keyboard listener:

```typescript
// Add to imports
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal';

// Add to component state
const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

// Add useEffect for global keyboard listener
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Only trigger when pressing ? and NOT in an input/textarea
    if (e.key === '?' && 
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) &&
        !(e.target as HTMLElement).closest('.monaco-editor')) {
      e.preventDefault();
      setShowKeyboardShortcuts(true);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

// Add modal to render (after other modals)
{showKeyboardShortcuts && (
  <KeyboardShortcutsModal
    open={showKeyboardShortcuts}
    onClose={() => setShowKeyboardShortcuts(false)}
  />
)}
```

**Update SettingsPanel to use constants:**

```typescript
// In fetch-boy/src/components/Settings/SettingsPanel.tsx
import { KEYBOARD_SHORTCUTS, getShortcutDisplay } from '@/lib/keyboardShortcuts';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

// Add inside component:
const theme = useUiSettingsStore((s) => s.theme);
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

// Replace hardcoded shortcut list with:
<dl className="space-y-1 text-sm" data-testid="keyboard-shortcuts-list">
  {KEYBOARD_SHORTCUTS.map((shortcut) => (
    <div key={shortcut.id} className="flex justify-between">
      <dt className="text-app-secondary">{shortcut.displayName}</dt>
      <dd className="text-app-primary font-mono text-xs">
        {getShortcutDisplay(isMac, shortcut)}
      </dd>
    </div>
  ))}
</dl>
```

**Update SettingsAccordion to use constants:**

Similarly update `fetch-boy/src/components/Sidebar/SettingsAccordion.tsx` to import from the constants file.

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Tailwind CSS v4 with dark mode
- Lucide React for icons
- Vitest + React Testing Library for tests

**Theme System:**
- Theme controlled via `useUiSettingsStore` with values: 'light' | 'dark' | 'system'
- Dark mode toggles `dark` class on `<html>` element
- Use `dark:` prefix in Tailwind for dark mode styles, or use CSS custom classes like `text-app-muted`

**Component Pattern:**
- Create reusable UI component in `components/ui/`
- Props interface with clear typing
- Follow existing component patterns in codebase
- Use Zustand store for global UI state when needed

### Integration Points

- **New file**: `fetch-boy/src/lib/keyboardShortcuts.ts` - Constants file
- **New file**: `fetch-boy/src/components/ui/KeyboardShortcutsModal.tsx` - Modal component
- **New file**: `fetch-boy/src/components/ui/KeyboardShortcutsModal.test.tsx` - Tests
- **Modified**: `fetch-boy/src/App.tsx` - Add global keyboard listener + modal
- **Modified**: `fetch-boy/src/components/Settings/SettingsPanel.tsx` - Use constants
- **Modified**: `fetch-boy/src/components/Sidebar/SettingsAccordion.tsx` - Use constants

### Critical Implementation Guardrails

1. **Single source of truth**: ALL keyboard shortcuts MUST be defined in `keyboardShortcuts.ts`
2. **Theme-aware**: Modal MUST work in both light and dark modes
3. **Input exclusion**: `?` shortcut MUST NOT trigger when user is typing in an input/textarea or Monaco editor
4. **Accessibility**: Include proper aria labels, keyboard navigation
5. **No regressions**: All existing keyboard shortcuts must continue to work
6. **Consistency**: Shortcut display format must match between modal and settings panel

### Previous Story Intelligence

**From Story 7.4 (Empty State Polish):**
- Created reusable EmptyState component in `components/ui/`
- Uses Lucide React icons (X, Send, etc.)
- Theme-aware via `useUiSettingsStore`
- Uses same modal pattern as SettingsPanel (fixed overlay with stopPropagation)

**From Story 7.3 (Sample Collection):**
- Uses Zustand for state management with SQLite persistence
- App.tsx integrates splash → tour → sample data flow

**From Story 7.2 (Onboarding Tutorial):**
- TourController uses Lucide icons for tutorial steps
- Uses consistent styling patterns with theme-aware colors

**From Story 7.1 (Startup Animation):**
- SplashScreen shows branding on startup
- Theme-aware with: `bg-white dark:bg-[#111827]`

**From Story 6.3 (Keyboard Shortcut to Send Request):**
- useSendRequestKeyboardShortcut hook already exists
- Already uses Cmd+Enter / Ctrl+Enter pattern

**From Story 5.4 (Tab Keyboard Shortcuts and Reordering):**
- useTabKeyboardShortcuts hook exists
- Tab keyboard shortcuts already implemented

### Testing Requirements

**Unit Tests (KeyboardShortcutsModal.test.tsx):**

```typescript
// Test: renders modal when open
render(<KeyboardShortcutsModal open={true} onClose={fn} />);
expect(screen.getByTestId('keyboard-shortcuts-modal')).toBeInTheDocument();

// Test: does not render when closed
render(<KeyboardShortcutsModal open={false} onClose={fn} />);
expect(screen.queryByTestId('keyboard-shortcuts-modal')).not.toBeInTheDocument();

// Test: closes on Escape key
const onClose = vi.fn();
render(<KeyboardShortcutsModal open={true} onClose={onClose} />);
fireEvent.keyDown(document, { key: 'Escape' });
expect(onClose).toHaveBeenCalled();

// Test: closes on click outside
const onClose = vi.fn();
render(<KeyboardShortcutsModal open={true} onClose={onClose} />);
fireEvent.click(screen.getByTestId('keyboard-shortcuts-overlay'));
expect(onClose).toHaveBeenCalled();

// Test: groups shortcuts by category
render(<KeyboardShortcutsModal open={true} onClose={fn} />);
expect(screen.getByText('General')).toBeInTheDocument();
expect(screen.getByText('Request')).toBeInTheDocument();
expect(screen.getByText('Tabs')).toBeInAllTheDocument();

// Test: displays all shortcuts from constants
render(<KeyboardShortcutsModal open={true} onClose={fn} />);
expect(screen.getByText('Send Request')).toBeInTheDocument();
expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument();
```

**Keyboard Shortcuts Constants Tests:**

```typescript
// Test: all shortcuts have required fields
KEYBOARD_SHORTCUTS.forEach((shortcut) => {
  expect(shortcut.id).toBeDefined();
  expect(shortcut.displayName).toBeDefined();
  expect(shortcut.category).toBeOneOf(['general', 'request', 'tabs']);
  expect(shortcut.macKeys).toBeDefined();
  expect(shortcut.windowsKeys).toBeDefined();
});

// Test: getShortcutDisplay returns correct format
const sendRequest = KEYBOARD_SHORTCUTS.find((s) => s.id === 'send-request')!;
expect(getShortcutDisplay(true, sendRequest)).toBe('⌘+Enter');
expect(getShortcutDisplay(false, sendRequest)).toBe('Ctrl+Enter');
```

**Integration Tests:**

```typescript
// Test: App.tsx listens for ? key and opens modal
// Test: SettingsPanel displays shortcuts from constants
// Test: SettingsAccordion displays shortcuts from constants
// Test: Modal is theme-aware (light/dark)
```

### Project Structure Notes

**New Files:**
- `fetch-boy/src/lib/keyboardShortcuts.ts` (new - single source of truth for all shortcuts)
- `fetch-boy/src/components/ui/KeyboardShortcutsModal.tsx` (new)
- `fetch-boy/src/components/ui/KeyboardShortcutsModal.test.tsx` (new)

**Modified Files:**
- `fetch-boy/src/App.tsx` (add keyboard listener + modal)
- `fetch-boy/src/components/Settings/SettingsPanel.tsx` (use constants)
- `fetch-boy/src/components/Sidebar/SettingsAccordion.tsx` (use constants)

**No New Dependencies:**
- Uses existing Lucide React icons
- Uses existing Tailwind CSS + dark mode
- Uses existing test patterns
- Uses existing useUiSettingsStore for theme detection

### References

- **Primary Source**: `_bmad-output/planning-artifacts/epic-7.md` (Story 7.5 acceptance criteria)
- **Theme System**: Story 4.1 - light/dark theme implementation
- **Existing Shortcuts**: Stories 6.3, 5.4 - existing keyboard shortcut implementations
- **Modal Pattern**: Story 7.4 - EmptyState component pattern, Story 4.3 - SettingsPanel modal pattern
- **Lucide Icons**: Already used throughout the app (X icon for close)
- **Testing**: Vitest + React Testing Library (consistent with project)
- **Existing Patterns**: useSendRequestKeyboardShortcut, useTabKeyboardShortcuts hooks

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

- Workflow: create-story (Story 7.5)
- Epic: 7 - First-Run Experience & Polish
- Previous Stories in Epic 7:
  - 7-1-startup-animation (SplashScreen, theme-aware)
  - 7-2-onboarding-tooltip-tutorial (TourController)
  - 7-3-sample-collection (sample data seeding)
  - 7-4-empty-state-polish (EmptyState component, theme-aware modal)
- Previous Epic Stories:
  - 6.3-keyboard-shortcut-to-send-request (useSendRequestKeyboardShortcut)
  - 5.4-tab-keyboard-shortcuts-and-reordering (useTabKeyboardShortcuts)
- Architecture: Tailwind CSS v4 with dark mode, Lucide React icons
- Context analysis completed

### Completion Notes List

- Created `keyboardShortcuts.ts` as single source of truth for all shortcuts with `KeyboardShortcut` interface and `getShortcutDisplay` helper
- Created `KeyboardShortcutsModal` component with category grouping (General/Request/Tabs), Escape key listener, and click-outside-to-close
- Added 12 unit tests covering: render, close on Escape, close on click-outside, no-close on inner click, category grouping, constants validation
- Added global `?` key listener in `App.tsx` (excluded inputs, textareas, Monaco editor)
- Updated `SettingsPanel` and `SettingsAccordion` to render from constants instead of hardcoded strings
- All 516 tests pass (42 test files), TypeScript compiles clean
- Commit: 8ebbdd3

### File List

- fetch-boy/src/lib/keyboardShortcuts.ts (new)
- fetch-boy/src/components/ui/KeyboardShortcutsModal.tsx (new)
- fetch-boy/src/components/ui/KeyboardShortcutsModal.test.tsx (new)
- fetch-boy/src/App.tsx (modified)
- fetch-boy/src/components/Settings/SettingsPanel.tsx (modified)
- fetch-boy/src/components/Sidebar/SettingsAccordion.tsx (modified)

## Change Log

- 2026-03-11: Story 7.5 implemented — keyboard shortcut overlay with `?` key, single-source constants, modal with category grouping; SettingsPanel and SettingsAccordion migrated to constants
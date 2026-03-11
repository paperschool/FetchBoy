# Story 7.6: What's New Modal on Update

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a returning user,
I want to see what changed after an update,
So that I notice new features without reading release notes.

## Acceptance Criteria

1. On launch, the app compares the stored version against the current `package.json` version
2. If the version has changed, a modal displays a bullet-point changelog for that version
3. Modal is dismissed with one click and is never reshown for the same version
4. Changelog entries are stored in a local JSON file

## Tasks / Subtasks

- [x] Task 1 - Create changelog JSON file and version storage (AC: 4)
  - [x] Create `fetch-boy/src/data/changelog.json` with version entries
  - [x] Add `lastSeenVersion` field to uiSettingsStore
  - [x] Create `getCurrentVersion()` utility to read from package.json

- [x] Task 2 - Create WhatsNewModal component (AC: 2, 3)
  - [x] Create `fetch-boy/src/components/ui/WhatsNewModal.tsx`
  - [x] Accept `version: string` and `changelog: ChangelogEntry[]` props
  - [x] Support theme-aware styling (light/dark mode)
  - [x] Single "Got it" button to dismiss
  - [x] Include test file

- [x] Task 3 - Implement version check logic in App.tsx (AC: 1)
  - [x] Read current version from package.json on app startup
  - [x] Compare with stored lastSeenVersion in uiSettingsStore
  - [x] If version changed, show WhatsNewModal after splash/tour
  - [x] Update lastSeenVersion after modal dismissed

- [x] Task 4 - Final Task - Commit story changes
  - [x] Run `npx tsc --noEmit` from `fetch-boy/` to verify TypeScript compilation
  - [x] Run `npx vitest run` from `fetch-boy/` to verify all tests pass
  - [x] Commit all code and documentation changes for this story with a message that includes Story 7.6

## Dev Notes

### Critical Implementation Details

**Changelog Data Structure:**

Create `fetch-boy/src/data/changelog.json`:

```json
{
  "changelog": [
    {
      "version": "0.1.0",
      "date": "2026-03-11",
      "changes": [
        "Initial release of FetchBoy - API testing made easy",
        "Request builder with Monaco editor",
        "Collections and history management",
        "Environment variables support",
        "Light and dark theme support"
      ]
    }
  ]
}
```

**Updated UiSettingsStore:**

Add `lastSeenVersion` to `fetch-boy/src/stores/uiSettingsStore.ts`:

```typescript
interface UiSettingsState {
  // ... existing fields
  lastSeenVersion: string | null;
  setLastSeenVersion: (version: string | null) => void;
}

// In the create() store:
lastSeenVersion: null,
setLastSeenVersion: (version) => set({ lastSeenVersion: version }),
```

**Version Utility:**

Create `fetch-boy/src/lib/appVersion.ts`:

```typescript
import packageJson from '../../package.json';

export function getCurrentVersion(): string {
  return packageJson.version;
}

export function isNewVersion(lastSeen: string | null): boolean {
  if (!lastSeen) return true;
  return lastSeen !== getCurrentVersion();
}
```

**WhatsNewModal Component:**

Create at `fetch-boy/src/components/ui/WhatsNewModal.tsx`:

```typescript
import { X, Sparkles } from 'lucide-react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useEffect } from 'react';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

interface WhatsNewModalProps {
  version: string;
  changelog: ChangelogEntry[];
  onDismiss: () => void;
}

export function WhatsNewModal({ version, changelog, onDismiss }: WhatsNewModalProps) {
  const theme = useUiSettingsStore((s) => s.theme);
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const latestChanges = changelog[0]; // Most recent

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="whats-new-overlay"
    >
      <div
        className={`bg-app-main border border-app-subtle rounded-lg p-6 w-[480px] shadow-xl ${isDark ? 'dark' : ''}`}
        data-testid="whats-new-modal"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500" size={24} />
            <h2 className="text-app-primary font-semibold text-xl">What's New</h2>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-sm font-medium">
              v{version}
            </span>
            <span className="text-app-muted text-sm">{latestChanges?.date}</span>
          </div>
          
          <ul className="space-y-2" data-testid="changelog-list">
            {latestChanges?.changes.map((change, index) => (
              <li key={index} className="flex items-start gap-2 text-app-primary text-sm">
                <span className="text-amber-500 mt-1">•</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onDismiss}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            data-testid="whats-new-dismiss"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Integration in App.tsx:**

```typescript
// Add imports
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { getCurrentVersion, isNewVersion } from '@/lib/appVersion';
import WhatsNewModal from '@/components/ui/WhatsNewModal';
import changelogData from '@/data/changelog.json';

// Add state
const [showWhatsNew, setShowWhatsNew] = useState(false);

// Add effect after tour/splash to check version
useEffect(() => {
  const lastSeen = useUiSettingsStore.getState().lastSeenVersion;
  const currentVersion = getCurrentVersion();
  
  if (isNewVersion(lastSeen)) {
    setShowWhatsNew(true);
    useUiSettingsStore.getState().setLastSeenVersion(currentVersion);
  }
}, []);

// Add modal to render
{showWhatsNew && (
  <WhatsNewModal
    version={getCurrentVersion()}
    changelog={changelogData.changelog}
    onDismiss={() => setShowWhatsNew(false)}
  />
)}
```

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Tailwind CSS v4 with dark mode
- Lucide React for icons (Sparkles)
- Zustand for state management
- Vitest + React Testing Library for tests

**Theme System:**
- Theme controlled via `useUiSettingsStore` with values: 'light' | 'dark' | 'system'
- Dark mode toggles `dark` class on `<html>` element
- Use `dark:` prefix in Tailwind for dark mode styles, or use CSS custom classes like `text-app-muted`

**Component Pattern:**
- Create reusable UI component in `components/ui/`
- Props interface with clear typing
- Follow existing component patterns in codebase (similar to KeyboardShortcutsModal)
- Use Zustand store for global UI state when needed

### Integration Points

- **New file**: `fetch-boy/src/data/changelog.json` - Changelog data
- **New file**: `fetch-boy/src/lib/appVersion.ts` - Version utilities
- **New file**: `fetch-boy/src/components/ui/WhatsNewModal.tsx` - Modal component
- **New file**: `fetch-boy/src/components/ui/WhatsNewModal.test.tsx` - Tests
- **Modified**: `fetch-boy/src/stores/uiSettingsStore.ts` - Add lastSeenVersion
- **Modified**: `fetch-boy/src/App.tsx` - Version check logic + modal

### Critical Implementation Guardrails

1. **Version comparison**: MUST compare stored lastSeenVersion with package.json on EVERY app launch
2. **One-time display**: Modal MUST NOT show again for the same version after dismissal
3. **Theme-aware**: Modal MUST work in both light and dark modes
4. **Single dismiss action**: Only "Got it" button needed, no "Don't show again" checkbox (version tracking handles this)
5. **Changelog format**: Changes stored as array of strings for bullet-point display
6. **Never block**: WhatsNewModal should NOT block app usage - it's informational only

### Previous Story Intelligence

**From Story 7.5 (Keyboard Shortcut Overlay):**
- Created reusable modal pattern in `components/ui/`
- Uses Lucide React icons (X for close)
- Theme-aware via `useUiSettingsStore`
- Uses fixed overlay with stopPropagation for click-outside handling

**From Story 7.4 (Empty State Polish):**
- Created reusable EmptyState component in `components/ui/`
- Uses Lucide React icons
- Theme-aware via `useUiSettingsStore`

**From Story 7.3 (Sample Collection):**
- Uses `hasSeededSampleData` in uiSettingsStore for one-time actions
- Pattern to follow: check flag → perform action → set flag to prevent re-execution

**From Story 7.2 (Onboarding Tutorial):**
- Uses TourController with step progression
- Shows after splash animation in App.tsx flow

**From Story 7.1 (Startup Animation):**
- SplashScreen shows branding on startup
- Theme-aware with: `bg-white dark:bg-[#111827]`

### Testing Requirements

**Unit Tests (WhatsNewModal.test.tsx):**

```typescript
// Test: renders modal with version and changes
render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={fn} />);
expect(screen.getByText('What\'s New')).toBeInTheDocument();
expect(screen.getByText('v0.1.0')).toBeInTheDocument();

// Test: displays all changes as bullet points
render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={fn} />);
expect(screen.getByText('Initial release')).toBeInTheDocument();

// Test: calls onDismiss when Got it clicked
const onDismiss = vi.fn();
render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={onDismiss} />);
fireEvent.click(screen.getByTestId('whats-new-dismiss'));
expect(onDismiss).toHaveBeenCalled();

// Test: closes on Escape key
const onDismiss = vi.fn();
render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={onDismiss} />);
fireEvent.keyDown(document, { key: 'Escape' });
expect(onDismiss).toHaveBeenCalled();

// Test: is theme-aware
```

**Version Utility Tests:**

```typescript
// Test: getCurrentVersion returns package.json version
expect(getCurrentVersion()).toBe('0.1.0');

// Test: isNewVersion returns true for null (first launch)
expect(isNewVersion(null)).toBe(true);

// Test: isNewVersion returns false for same version
expect(isNewVersion('0.1.0')).toBe(false);

// Test: isNewVersion returns true for different version
expect(isNewVersion('0.0.9')).toBe(true);
```

**Integration Tests:**

```typescript
// Test: App.tsx shows modal when version changed
// Test: App.tsx does NOT show modal when version same
// Test: lastSeenVersion is updated after dismiss
// Test: Modal is theme-aware (light/dark)
```

### Project Structure Notes

**New Files:**
- `fetch-boy/src/data/changelog.json` (new - changelog entries)
- `fetch-boy/src/lib/appVersion.ts` (new - version utilities)
- `fetch-boy/src/components/ui/WhatsNewModal.tsx` (new)
- `fetch-boy/src/components/ui/WhatsNewModal.test.tsx` (new)

**Modified Files:**
- `fetch-boy/src/stores/uiSettingsStore.ts` (add lastSeenVersion)
- `fetch-boy/src/App.tsx` (version check + modal integration)

**No New Dependencies:**
- Uses existing Lucide React icons
- Uses existing Tailwind CSS + dark mode
- Uses existing test patterns
- Uses existing useUiSettingsStore for theme detection and persistence

### References

- **Primary Source**: `_bmad-output/planning-artifacts/epic-7.md` (Story 7.6 acceptance criteria)
- **Version Pattern**: Similar to `hasSeededSampleData` in uiSettingsStore
- **Theme System**: Story 4.1 - light/dark theme implementation
- **Modal Pattern**: Story 7.5 - KeyboardShortcutsModal component pattern
- **Lucide Icons**: Already used throughout the app (Sparkles for new feature)
- **Testing**: Vitest + React Testing Library (consistent with project)
- **Existing Patterns**: Zustand persist middleware for storage

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

- Workflow: create-story (Story 7.6)
- Epic: 7 - First-Run Experience & Polish
- Previous Stories in Epic 7:
  - 7-5-keyboard-shortcut-overlay (WhatsNewModal pattern from KeyboardShortcutsModal)
  - 7-4-empty-state-polish (EmptyState component)
  - 7-3-sample-collection (hasSeededSampleData pattern - one-time actions)
  - 7-2-onboarding-tooltip-tutorial (TourController)
  - 7-1-startup-animation (SplashScreen)
- Architecture: Tailwind CSS v4 with dark mode, Lucide React icons, Zustand
- Context analysis completed

### Completion Notes List

- [Done] Created `fetch-boy/src/data/changelog.json` with v0.1.0 changelog entries
- [Done] Added `lastSeenVersion` + `setLastSeenVersion` to `uiSettingsStore`
- [Done] Added `last_seen_version` to `AppSettings` in `db.ts` and `settings.ts`
- [Done] Updated `AppShell.tsx` to load `lastSeenVersion` from DB settings on startup
- [Done] Created `fetch-boy/src/lib/appVersion.ts` with `getCurrentVersion()` and `isNewVersion()`
- [Done] Created `WhatsNewModal.tsx` component with theme-aware styling, Escape key support, and "Got it" dismiss button
- [Done] Created `WhatsNewModal.test.tsx` with 10 tests (all passing)
- [Done] Created `appVersion.test.ts` with 6 tests (all passing)
- [Done] Integrated version check in `App.tsx` after splash/tour with DB persistence
- [Done] Updated `settings.test.ts` to include `last_seen_version: null` in expected results
- [Done] Added `resolveJsonModule: true` to `tsconfig.app.json` for JSON import support
- [Done] TypeScript: 0 errors; Tests: 532 passed, 0 failed

### File List

- fetch-boy/src/data/changelog.json (new)
- fetch-boy/src/lib/appVersion.ts (new)
- fetch-boy/src/lib/appVersion.test.ts (new)
- fetch-boy/src/components/ui/WhatsNewModal.tsx (new)
- fetch-boy/src/components/ui/WhatsNewModal.test.tsx (new)
- fetch-boy/src/stores/uiSettingsStore.ts (modified)
- fetch-boy/src/App.tsx (modified)
- fetch-boy/src/lib/db.ts (modified)
- fetch-boy/src/lib/settings.ts (modified)
- fetch-boy/src/lib/settings.test.ts (modified)
- fetch-boy/src/components/Layout/AppShell.tsx (modified)
- fetch-boy/tsconfig.app.json (modified)

## Change Log

- 2026-03-11: Story 7.6 created — What's New Modal on Update with version comparison, changelog JSON, theme-aware modal
- 2026-03-11: Story 7.6 implemented — WhatsNewModal component, appVersion utility, uiSettingsStore lastSeenVersion, DB persistence, App.tsx integration. All 532 tests pass, TypeScript clean.

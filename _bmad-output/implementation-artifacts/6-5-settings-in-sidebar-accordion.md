# Story 6.5: Settings in Sidebar Accordion

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to access application settings from the sidebar,
So that I can quickly configure the app without navigating to a separate settings panel.

## Acceptance Criteria

1. A new **Settings** accordion section appears beneath the Collection/History tab interface in the sidebar
2. When expanded, the accordion contains the same settings available in the current Settings panel (Story 4.3), including but not limited to:
   - Theme selection (light/dark)
   - Default timeout value
   - Import/Export options
   - Any other configurable settings
3. The accordion collapses/expands smoothly with a chevron indicator
4. When the sidebar is **minimised** (collapsed to icon-only strip per Story 6.1), the Settings option appears as a separate selectable icon in the collapsed strip
5. Clicking the Settings icon in the minimised state opens the settings in a popover or modal, or expands the sidebar to show the Settings accordion
6. The Settings state (expanded/collapsed) is persisted in app settings and restored on next launch
7. **REMOVED**: The settings button in the TopBar (top right) is removed - settings are ONLY accessible from the sidebar
8. The original SettingsPanel component is removed from the TopBar - settings are now ONLY available in the sidebar accordion
9. Settings changes apply globally and persist regardless of access point
10. The accordion is keyboard accessible (focusable, activatable via Enter/Space)

## Tasks / Subtasks

- [x] Task 1 - Add Settings accordion to Sidebar component (AC: 1, 2, 3)
  - [x] Create SettingsAccordion component in `fetch-boy/src/components/Sidebar/`
  - [x] Add accordion section beneath Collection/History tabs
  - [x] Integrate existing settings from SettingsPanel (Story 4.3)
  - [x] Implement smooth collapse/expand with chevron indicator
  - [x] Ensure keyboard accessibility (focusable, Enter/Space activation)

- [x] Task 2 - Add Settings icon to collapsed sidebar (AC: 4, 5)
  - [x] Add Settings icon (gear icon from lucide-react) to collapsed sidebar strip
  - [x] Implement click handler: open settings in popover/modal OR expand sidebar
  - [x] Make the behavior configurable or follow consistent pattern with other collapsed items

- [x] Task 3 - Persist Settings accordion state (AC: 6)
  - [x] Add `settingsExpanded: boolean` to app settings/store
  - [x] Save state on expand/collapse change
  - [x] Restore state on app launch

- [x] Task 4 - Remove settings from TopBar (AC: 7, 8)
  - [x] Remove the Settings button from TopBar.tsx (top right)
  - [x] Remove SettingsPanel import and usage from TopBar
  - [x] Remove settingsPanelOpen state from uiSettingsStore (or mark as unused)
  - [x] Verify TopBar.tsx tests are updated or removed

- [x] Task 5 - Ensure settings sync (AC: 9)
  - [x] Settings store should be shared between Sidebar accordion and wherever else needed
  - [x] Changes in sidebar immediately reflect across the app
  - [x] No duplicate state management

- [x] Task 6 - Write tests (AC: all)
  - [x] Write unit tests for SettingsAccordion component
  - [x] Test expand/collapse functionality
  - [x] Test settings changes persist correctly
  - [x] Test state persistence

- [x] Task 7 - Verify and commit story changes
  - [x] Run `npx tsc --noEmit` from `fetch-boy/` to verify TypeScript compilation
  - [x] Run `npx vitest run` from `fetch-boy/` to verify all tests pass
  - [ ] Manual test: Expand settings accordion, change theme, verify change applies
  - [ ] Manual test: Collapse sidebar, click Settings icon, verify behavior
  - [ ] Manual test: Verify settings button is removed from TopBar
  - [x] Commit all code and documentation changes with a message including `Story 6.5`

## Dev Notes

### Critical Implementation Details

**Settings Accordion Component:**

The Settings accordion should integrate the existing SettingsPanel content. Based on Story 4.3, the SettingsPanel contains theme selection, default timeout, import/export options.

```typescript
// SettingsAccordion.tsx structure
import { ChevronDown, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

interface SettingsAccordionProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function SettingsAccordion({ isExpanded, onToggle }: SettingsAccordionProps) {
  // Reuse settings from SettingsPanel
  const { theme, setTheme, defaultTimeout, setDefaultTimeout } = useSettingsStore();
  
  return (
    <div className="settings-accordion">
      <button 
        className="accordion-header flex items-center gap-2 p-2"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls="settings-content"
      >
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <SettingsIcon size={16} />
        <span>Settings</span>
      </button>
      
      {isExpanded && (
        <div id="settings-content" className="accordion-content p-2">
          {/* Reuse SettingsPanel content here */}
          <ThemeSelector value={theme} onChange={setTheme} />
          <TimeoutSetting value={defaultTimeout} onChange={setDefaultTimeout} />
          <ImportExportOptions />
        </div>
      )}
    </div>
  );
}
```

**Collapsed Sidebar Settings Icon:**

When sidebar is minimized (Story 6.1), show Settings icon in the icon strip:

```typescript
// In Sidebar.tsx - collapsed state
const collapsedItems = [
  { icon: <FolderOpen />, label: 'Collections', tab: 'collections' },
  { icon: <History />, label: 'History', tab: 'history' },
  { icon: <SettingsIcon />, label: 'Settings', action: 'openSettings' },
];
```

**State Persistence:**

```typescript
// In settingsStore.ts or appStore.ts
interface AppSettings {
  // ... existing settings
  sidebarSettingsExpanded: boolean;
}

// Load from localStorage on init
const loadSettings = () => {
  const saved = localStorage.getItem('app-settings');
  if (saved) {
    return JSON.parse(saved);
  }
  return { sidebarSettingsExpanded: false, /* defaults */ };
};

// Save on change
const saveSettings = (settings: AppSettings) => {
  localStorage.setItem('app-settings', JSON.stringify(settings));
};
```

**Settings Synchronization:**

Both Sidebar and SettingsPanel must share the same settings store:

```typescript
// Using Zustand store - both components use same store
import { useSettingsStore } from '@/stores/settingsStore';

// In SettingsPanel.tsx
const { theme, setTheme } = useSettingsStore();

// In Sidebar/SettingsAccordion.tsx  
const { theme, setTheme } = useSettingsStore();

// Changes propagate automatically - no sync needed!
```

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Zustand for state management
- Tailwind CSS utility classes with `app-*` custom tokens
- Vitest + React Testing Library for tests
- lucide-react for icons (Settings, ChevronDown, ChevronRight)
- Tauri/Rust backend for persistence

**Component/File Conventions:**
- Accordion components in `fetch-boy/src/components/Sidebar/`
- Settings reusable components in `fetch-boy/src/components/Settings/`
- Tests co-located: `ComponentName.test.tsx` alongside source

**State Management Rules:**
- All settings stored in single settings store (Zustand)
- Both Sidebar and SettingsPanel read from same store
- State persisted to localStorage via Tauri or directly

### Integration Points

- **Sidebar**: Add SettingsAccordion component, add Settings icon to collapsed state
- **TopBar**: Remove Settings button and SettingsPanel (settings are now ONLY in sidebar)
- **SettingsPanel**: Component remains but is only used within Sidebar accordion (reused, not duplicated)
- **settingsStore**: Add `sidebarSettingsExpanded` state
- **uiSettingsStore**: Remove `settingsPanelOpen` state (no longer needed)
- **Story 6.1**: Foldable side panel - check for collapsed state handling
- **Story 4.3**: Settings panel - reuse existing settings components

### Critical Implementation Guardrails

1. **REMOVE TopBar settings**: The settings button in TopBar (top right) must be removed. Settings are ONLY accessible from the sidebar accordion.

2. **Reuse, don't duplicate**: The SettingsPanel already exists from Story 4.3. Extract its content into reusable components and use them in the sidebar accordion.

3. **State sync**: Settings must show same values throughout the app. Use shared Zustand store.

4. **Collapsed sidebar behavior**: AC states "opens the settings in a popover or modal, OR expands the sidebar" - choose one consistent approach.

5. **Persistence**: Settings accordion expanded/collapsed state must persist across app restarts.

6. **Keyboard accessibility**: Accordion header must be focusable and activatable via Enter/Space.

7. **No regressions**: All existing settings functionality must work from the sidebar accordion.

### Previous Story Intelligence

**From Story 6.4 (Request Timeout Configuration):**
- Story 6.4 adds timeout setting to SettingsPanel
- Story 6.5 should include this timeout setting in the sidebar accordion
- The timeout setting should be reused from the shared settings store

**From Story 6.1 (Foldable Side Panel):**
- Sidebar can be collapsed to icon-only strip
- Story 6.5 needs to handle the collapsed state
- Need to add Settings icon to collapsed strip items

**From Story 4.3 (Settings Panel):**
- SettingsPanel exists with theme, timeout, import/export
- These components should be extracted for reuse in sidebar
- Check existing Settings structure before building

### Testing Requirements

**Unit Tests (SettingsAccordion.test.tsx):**

```typescript
// Test: Accordion expands on click
render(<SettingsAccordion isExpanded={false} onToggle={fn} />);
fireEvent.click(screen.getByRole('button'));
expect(fn).toHaveBeenCalled();

// Test: Accordion shows content when expanded
render(<SettingsAccordion isExpanded={true} onToggle={fn} />);
expect(screen.getByText('Theme')).toBeInTheDocument();

// Test: Keyboard accessibility
render(<SettingsAccordion isExpanded={false} onToggle={fn} />);
const button = screen.getByRole('button');
fireEvent.keyDown(button, { key: 'Enter' });
expect(fn).toHaveBeenCalled();
```

**Integration Tests:**

```typescript
// Test: Settings sync between Sidebar and SettingsPanel
// Test: State persistence across renders
// Test: Collapsed sidebar Settings icon behavior
```

### Project Structure Notes

**New Files:**
- `fetch-boy/src/components/Sidebar/SettingsAccordion.tsx` - New accordion component
- `fetch-boy/src/components/Sidebar/SettingsAccordion.test.tsx` - Test file

**Modified Files:**
- `fetch-boy/src/components/Sidebar/Sidebar.tsx` - Add accordion and collapsed icon
- `fetch-boy/src/components/TopBar/TopBar.tsx` - REMOVE Settings button and SettingsPanel
- `fetch-boy/src/components/TopBar/TopBar.test.tsx` - Update or remove settings-related tests
- `fetch-boy/src/components/Settings/SettingsPanel.tsx` - Reuse in sidebar accordion
- `fetch-boy/src/stores/settingsStore.ts` - Add sidebar state
- `fetch-boy/src/stores/uiSettingsStore.ts` - Remove settingsPanelOpen state

**Potential Refactoring:**
- Extract settings control components (ThemeSelector, TimeoutSetting) from SettingsPanel for reuse
- Or simply render SettingsPanel content in both locations

### References

- **Primary Source**: `_bmad-output/planning-artifacts/epic-6.md` (Story 6.5 acceptance criteria)
- **Sidebar**: `fetch-boy/src/components/Sidebar/Sidebar.tsx` (existing sidebar structure)
- **SettingsPanel**: `fetch-boy/src/components/Settings/SettingsPanel.tsx` (Story 4.3 - existing settings)
- **Story 6.1**: Foldable side panel for collapsed state handling
- **Story 4.3**: Settings panel for reusable settings components
- **Story 6.4**: Timeout setting that needs to be included in sidebar

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Workflow: create-story (Story 6.5)
- Epic: 6 - Workspace Ergonomics & Developer Flow
- Previous Stories: 6-1-foldable-side-panel, 6-2-request-cancellation, 6-3-keyboard-shortcut-to-send-request, 6-4-request-timeout-configuration
- Auto-generated context engine analysis completed

### Completion Notes List

- Created `SettingsAccordion` component with all settings controls inline (theme, timeout, SSL, font size, keyboard shortcuts). Uses same `useUiSettingsStore` as `SettingsPanel` — changes sync automatically across app.
- Added `sidebarSettingsExpanded` / `setSidebarSettingsExpanded` to `uiSettingsStore`, replacing the removed `settingsPanelOpen` / `setSettingsPanelOpen`.
- Added `sidebar_settings_expanded` to `AppSettings` interface (`db.ts`) and `loadAllSettings` (`settings.ts`) with default `false`. Persisted via SQLite `saveSetting` on every toggle.
- `Sidebar.tsx`: accordion appended at bottom inside flex-col; panel content wrapped in `flex-1 min-h-0 overflow-y-auto` to scroll independently. Collapsed strip gains a Settings gear icon pinned to `mt-auto` (bottom); clicking it sets `sidebarSettingsExpanded=true` and calls `onToggle()` to expand.
- `TopBar.tsx`: removed Settings button, SettingsPanel import, and `useUiSettingsStore` usage entirely.
- `AppShell.tsx`: replaced `setSettingsPanelOpen` context-menu action with sidebar expand + settings open. Loads `sidebar_settings_expanded` on startup.
- 463 tests passing (36 files); 18 new tests in `SettingsAccordion.test.tsx`; `Sidebar.test.tsx` expanded with 8 new cases; `TopBar.test.tsx` updated; `settings.test.ts` updated.

### File List

- `fetch-boy/src/components/Sidebar/SettingsAccordion.tsx` (new)
- `fetch-boy/src/components/Sidebar/SettingsAccordion.test.tsx` (new)
- `fetch-boy/src/components/Sidebar/Sidebar.tsx` (modified)
- `fetch-boy/src/components/Sidebar/Sidebar.test.tsx` (modified)
- `fetch-boy/src/components/TopBar/TopBar.tsx` (modified)
- `fetch-boy/src/components/TopBar/TopBar.test.tsx` (modified)
- `fetch-boy/src/stores/uiSettingsStore.ts` (modified)
- `fetch-boy/src/lib/db.ts` (modified)
- `fetch-boy/src/lib/settings.ts` (modified)
- `fetch-boy/src/lib/settings.test.ts` (modified)
- `fetch-boy/src/components/Layout/AppShell.tsx` (modified)

## Change Log

- 2026-03-11: Story 6.5 context created via automated create-story workflow — comprehensive developer guide with sidebar settings accordion, collapsed state handling, settings synchronization, and state persistence

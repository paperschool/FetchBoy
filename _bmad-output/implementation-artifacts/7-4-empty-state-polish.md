# Story 7.4: Empty State Polish

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see welcoming empty states instead of blank space,
So that the app feels intentional and guides me toward the next action.

## Acceptance Criteria

1. Collections sidebar displays a distinct empty state with label and icon when no collections exist (e.g. "No collections yet — create one to get started")
2. Request history displays a distinct empty state with label and icon when no history exists (e.g. "Your sent requests will appear here")
3. Response panel displays a distinct empty state with label and icon before the first request is sent (e.g. "Hit Send to see your response")
4. All empty state components are theme-aware (light/dark)

## Tasks / Subtasks

- [x] Task 1 - Create reusable EmptyState component (AC: 1, 2, 3, 4)
  - [x] Create `src/components/ui/EmptyState.tsx`
  - [x] Accept props: icon, label, optional action (button/link), actionLabel
  - [x] Support theme-aware styling (light/dark mode)
  - [x] Include test file

- [x] Task 2 - Update CollectionTree empty state (AC: 1, 4)
  - [x] Replace existing empty state with new EmptyState component
  - [x] Add folder icon (Lucide React)
  - [x] Label: "No collections yet — create one to get started"
  - [x] Action button: "Create Collection" that triggers handleAddCollection

- [x] Task 3 - Update HistoryPanel empty state (AC: 2, 4)
  - [x] Replace existing empty state with new EmptyState component
  - [x] Add clock/history icon (Lucide React)
  - [x] Label: "Your sent requests will appear here"
  - [x] No action button needed (guiding text is sufficient)

- [x] Task 4 - Update ResponseViewer empty state (AC: 3, 4)
  - [x] Add EmptyState component when no response/error/cancelled state
  - [x] Add send/arrow icon (Lucide React)
  - [x] Label: "Hit Send to see your response"
  - [x] Ensure theme-aware styling throughout

- [x] Task 5 - Final Task - Commit story changes
  - [x] Run `npx tsc --noEmit` from `` to verify TypeScript compilation
  - [x] Run `npx vitest run` from `` to verify all tests pass
  - [x] Commit all code and documentation changes for this story with a message that includes Story 7.4

## Dev Notes

### Critical Implementation Details

**Reusable EmptyState Component:**

Create a new component at `src/components/ui/EmptyState.tsx`:

```typescript
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  label: string;
  action?: () => void;
  actionLabel?: string;
}

export function EmptyState({ icon: Icon, label, action, actionLabel }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <Icon className="h-10 w-10 text-app-muted mb-3" />
      <p className="text-app-muted text-sm mb-3">{label}</p>
      {action && actionLabel && (
        <button
          onClick={action}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
```

**Theme-Aware Styling:**

All empty states must use theme-aware colors. The app uses:
- Light mode: `text-gray-500` for muted text
- Dark mode: `text-app-muted` (custom CSS variable or Tailwind dark: variant)

Example with explicit dark mode support:
```typescript
<p className="text-gray-500 dark:text-gray-400 text-sm">
  Your sent requests will appear here
</p>
```

**CollectionTree Integration:**

Replace existing empty state (around line 214):
```typescript
// BEFORE:
{tree.length === 0 && (
  <div data-testid="empty-state" className="text-app-muted text-sm text-center py-6 px-2">
    <p>No collections yet.</p>
    <button onClick={handleAddCollection} className="text-blue-300 hover:underline mt-1 text-sm">
      Create one
    </button>
  </div>
)}

// AFTER:
{tree.length === 0 && (
  <EmptyState
    icon={FolderIcon}
    label="No collections yet — create one to get started"
    action={handleAddCollection}
    actionLabel="Create Collection"
  />
)}
```

Note: Import appropriate Lucide icon (e.g., `Folder` or `FolderOpen`)

**HistoryPanel Integration:**

Replace existing empty state (around line 71):
```typescript
// BEFORE:
{entries.length === 0 && (
  <div data-testid="history-empty-state" className="flex-1 flex items-center justify-center text-xs text-app-muted text-center">
    No history yet. Send a request to get started.
  </div>
)}

// AFTER:
{entries.length === 0 && (
  <EmptyState
    icon={History}
    label="Your sent requests will appear here"
  />
)}
```

Note: `History` is already imported from lucide-react in this file.

**ResponseViewer Integration:**

The ResponseViewer currently returns `null` when no response exists (around line 56):
```typescript
// BEFORE:
if (!response && !error && logs.length === 0 && !wasCancelled && !wasTimedOut) {
  return null;
}

// AFTER - Add empty state instead of returning null:
if (!response && !error && logs.length === 0 && !wasCancelled && !wasTimedOut) {
  return (
    <section data-testid="response-viewer" className="border-app-subtle flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-md border p-3">
      <EmptyState
        icon={Send}
        label="Hit Send to see your response"
      />
    </section>
  );
}
```

Note: Import Send icon from lucide-react.

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

### Integration Points

- **New file**: `src/components/ui/EmptyState.tsx`
- **New file**: `src/components/ui/EmptyState.test.tsx`
- **Modified**: `src/components/CollectionTree/CollectionTree.tsx` - replace empty state
- **Modified**: `src/components/HistoryPanel/HistoryPanel.tsx` - replace empty state
- **Modified**: `src/components/ResponseViewer/ResponseViewer.tsx` - add empty state

### Critical Implementation Guardrails

1. **Theme-aware**: All empty states MUST work in both light and dark modes
2. **Icons**: Use Lucide React icons already in the project (no new dependencies)
3. **Accessibility**: Include proper aria labels if needed
4. **Consistency**: Empty states across the app should have similar visual weight and style
5. **Test IDs**: Keep existing test IDs or add new ones for empty states
6. **No regressions**: All existing functionality must work after changes

### Previous Story Intelligence

**From Story 7.3 (Sample Collection):**
- Uses Zustand for state management with SQLite persistence
- App.tsx integrates splash → tour → sample data flow
- Uses Lucide React icons throughout
- Collection store structure: { collections, folders, requests }

**From Story 4.1 (Light/Dark Theme):**
- Theme is stored in uiSettingsStore: 'light' | 'dark' | 'system'
- Dark mode adds 'dark' class to document.documentElement
- Tailwind dark: prefix for dark mode styles
- Custom CSS variables: text-app-muted, text-app-inverse, bg-app-main, etc.

**From Story 7.1 (Startup Animation):**
- SplashScreen shows branding on startup
- Theme-aware with: `bg-white dark:bg-[#111827]`
- Uses Lucide React icons

**From Story 7.2 (Onboarding Tutorial):**
- TourController uses Lucide icons for tutorial steps
- Uses consistent styling patterns

### Testing Requirements

**Unit Tests (EmptyState.test.tsx):**

```typescript
// Test: renders icon and label
render(<EmptyState icon={Folder} label="No items" />);
expect(screen.getByText('No items')).toBeInTheDocument();

// Test: renders action button when provided
const mockAction = vi.fn();
render(<EmptyState icon={Folder} label="No items" action={mockAction} actionLabel="Add" />);
expect(screen.getByText('Add')).toBeInTheDocument();
fireEvent.click(screen.getByText('Add'));
expect(mockAction).toHaveBeenCalled();

// Test: does not render action when not provided
render(<EmptyState icon={Folder} label="No items" />);
expect(screen.queryByRole('button')).not.toBeInTheDocument();

// Test: applies custom className
render(<EmptyState icon={Folder} label="No items" className="custom-class" />);
expect(screen.getByText('No items').closest('div')).toHaveClass('custom-class');
```

**Integration Tests:**

```typescript
// Test: CollectionTree shows EmptyState when no collections
// Test: HistoryPanel shows EmptyState when no history
// Test: ResponseViewer shows EmptyState when no response
// Test: EmptyState is theme-aware (verify light/dark classes)
```

### Project Structure Notes

**New Files:**
- `src/components/ui/EmptyState.tsx` (new)
- `src/components/ui/EmptyState.test.tsx` (new)

**Modified Files:**
- `src/components/CollectionTree/CollectionTree.tsx` (replace empty state)
- `src/components/HistoryPanel/HistoryPanel.tsx` (replace empty state)
- `src/components/ResponseViewer/ResponseViewer.tsx` (add empty state)

**No New Dependencies:**
- Uses existing Lucide React icons
- Uses existing Tailwind CSS + dark mode
- Uses existing test patterns

### References

- **Primary Source**: `_bmad-output/planning-artifacts/epic-7.md` (Story 7.4 acceptance criteria)
- **Theme System**: Story 4.1 - light/dark theme implementation
- **Lucide Icons**: Already used throughout the app
- **Testing**: Vitest + React Testing Library (consistent with project)
- **Existing Patterns**: CollectionTree, HistoryPanel, ResponseViewer current implementations

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

- Workflow: create-story (Story 7.4)
- Epic: 7 - First-Run Experience & Polish
- Previous Stories: 
  - 7-1-startup-animation (SplashScreen, theme-aware)
  - 7-2-onboarding-tooltip-tutorial (TourController)
  - 7-3-sample-collection (sample data seeding)
- Architecture: Tailwind CSS v4 with dark mode, Lucide React icons
- Context analysis completed

### Completion Notes List

- Comprehensive story created with all implementation details
- EmptyState component design complete with props interface
- Integration points identified in CollectionTree, HistoryPanel, ResponseViewer
- Theme-aware styling guidance provided
- Testing requirements documented
- **Implementation complete (2026-03-11):**
  - Created `EmptyState.tsx` reusable component with icon, label, optional action, and className props
  - Created `EmptyState.test.tsx` with 4 unit tests (all passing)
  - Updated `CollectionTree.tsx`: replaced ad-hoc empty state with `<EmptyState icon={Folder} ...>` + "Create Collection" action
  - Updated `HistoryPanel.tsx`: replaced ad-hoc empty state with `<EmptyState icon={History} ...>`
  - Updated `ResponseViewer.tsx`: replaced `return null` with `<EmptyState icon={Send} ...>` inside `<section data-testid="response-viewer">`
  - Updated `ResponseViewer.test.tsx` and `HistoryPanel.test.tsx` to reflect new empty state behavior
  - All 504 tests pass; TypeScript compilation clean; no regressions

### File List

- `src/components/ui/EmptyState.tsx` (new)
- `src/components/ui/EmptyState.test.tsx` (new)
- `src/components/CollectionTree/CollectionTree.tsx` (modified)
- `src/components/HistoryPanel/HistoryPanel.tsx` (modified)
- `src/components/ResponseViewer/ResponseViewer.tsx` (modified)
- `src/components/ResponseViewer/ResponseViewer.test.tsx` (modified - updated 2 tests for new empty state behavior)
- `src/components/HistoryPanel/HistoryPanel.test.tsx` (modified - updated 1 test for new empty state text)
- `_bmad-output/implementation-artifacts/7-4-empty-state-polish.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified - status updated)

## Change Log

- Story 7.4 created: Empty State Polish comprehensive implementation guide (Date: 2026-03-11)
- Story 7.4 implemented: EmptyState component created; integrated into CollectionTree, HistoryPanel, ResponseViewer; all 504 tests pass (Date: 2026-03-11)

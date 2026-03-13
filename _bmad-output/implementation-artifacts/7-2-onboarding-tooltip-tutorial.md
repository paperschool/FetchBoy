# Story 7.2: Onboarding Tooltip Tutorial

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new user,
I want to see an interactive tooltip tour that highlights key features,
So that I can quickly understand how to use the app without reading documentation.

## Acceptance Criteria

1. A tooltip-based tour appears on first app launch after the startup animation
2. The tour highlights 4-5 key UI areas in sequence:
   1. Collections sidebar - "Organize your API requests here"
   2. Request builder - "Build your HTTP request"
   3. Send button - "Click to send your request"
   4. Response panel - "View your API response here"
   5. Settings/Environment - "Configure environments and auth"
3. Each tooltip has a "Next" button to proceed to the next step, and "Skip" to exit the tour
4. The current tooltip points to its target UI element with an arrow or highlight
5. The tour state is persisted - if a user exits mid-way, it remembers where they were (or can restart)
6. A "Restart Tutorial" option is available in Settings for users who want to see it again
7. The tooltip library used is compatible with React and doesn't conflict with existing UI
8. Tour can be dismissed with Escape key or by clicking outside

## Tasks / Subtasks

- [x] Task 1 - Research and select tooltip library (AC: 7)
  - [x] Research React tooltip libraries (react-joyride, reactour, driver.js, etc.)
  - [x] Evaluate compatibility with existing UI stack (Tailwind, React 18+)
  - [x] Select library and justify choice in dev notes
  - [x] Install and verify no conflicts with existing components

- [x] Task 2 - Create TourContext for state management (AC: 5, 6)
  - [x] Create Zustand store for tour state
  - [x] Track: currentStep, hasCompletedTour, hasSeenStep (per step)
  - [x] Persist to localStorage for cross-session recall
  - [x] Add reset/restart capability

- [x] Task 3 - Build TourController component (AC: 1-4, 8)
  - [x] Create TourController.tsx in components/Layout/
  - [x] Configure tour steps matching AC #2
  - [x] Add Next/Skip buttons to each tooltip
  - [x] Add arrow/highlight pointing to target elements
  - [x] Handle Escape key and click-outside to dismiss
  - [x] Integrate after startup animation completes (story 7.1)

- [x] Task 4 - Identify target elements for tour (AC: 2)
  - [x] Verify Collections sidebar has stable ID/selector
  - [x] Verify Request builder has stable ID/selector
  - [x] Verify Send button has stable ID/selector
  - [x] Verify Response panel has stable ID/selector
  - [x] Verify Settings/Environment has stable ID/selector

- [x] Task 5 - Add "Restart Tutorial" in Settings (AC: 6)
  - [x] Add tour restart button/option in Settings panel
  - [x] Wire to TourContext reset function
  - [x] Test restart from mid-tour and from fully completed

- [x] Task 6 - Write tests (AC: all)
  - [x] Write unit tests for TourContext store
  - [x] Test tour flow progression
  - [x] Test skip/dismiss functionality
  - [x] Test persistence across page reloads
  - [x] Test restart functionality

- [x] Task 7 - Final Task - Commit story changes
  - [x] Run `npx tsc --noEmit` from `` to verify TypeScript compilation
  - [x] Run `npx vitest run` from `` to verify all tests pass
  - [x] Commit all code and documentation changes for this story with a message that includes Story 7.2

## Dev Notes

### Critical Implementation Details

**Tooltip Library Selection:**

Research the following options and select the best fit:

1. **react-joyride**: Popular, well-maintained, good customization
2. **reactour**: Simple API, good for custom styling
3. **driver.js**: Lightweight, no dependencies, good for highlight overlays

Consider: React 18 compatibility, Tailwind CSS integration, bundle size, last update, active maintenance.

**TourContext Store:**

```typescript
// stores/tourStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TourState {
  hasCompletedTour: boolean;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  completeTour: () => void;
  resetTour: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      hasCompletedTour: false,
      currentStep: 0,
      setCurrentStep: (step) => set({ currentStep: step }),
      completeTour: () => set({ hasCompletedTour: true, currentStep: 0 }),
      resetTour: () => set({ hasCompletedTour: false, currentStep: 0 }),
    }),
    {
      name: 'fetchboy-tour-storage',
    }
  )
);
```

**TourController Component:**

```typescript
// components/Layout/TourController.tsx
import { useEffect } from 'react';
import Joyride, { STATUS, Step } from 'react-joyride';
import { useTourStore } from '@/stores/tourStore';

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="collections-sidebar"]',
    content: 'Organize your API requests here',
    placement: 'right',
  },
  {
    target: '[data-tour="request-builder"]',
    content: 'Build your HTTP request',
    placement: 'bottom',
  },
  {
    target: '[data-tour="send-button"]',
    content: 'Click to send your request',
    placement: 'top',
  },
  {
    target: '[data-tour="response-panel"]',
    content: 'View your API response here',
    placement: 'left',
  },
  {
    target: '[data-tour="settings-env"]',
    content: 'Configure environments and auth',
    placement: 'left',
  },
];

export function TourController() {
  const { hasCompletedTour, currentStep, setCurrentStep, completeTour } = useTourStore();

  const handleTourEnd = (data: { status: string }) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      completeTour();
    }
  };

  if (hasCompletedTour) {
    return null;
  }

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={true}
      stepIndex={currentStep}
      continuous={true}
      showSkip={true}
      showProgress={true}
      floaterProps={{ disableAnimation: true }}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#6366f1',
        },
      }}
      callback={handleTourEnd}
    />
  );
}
```

**Integration with App (after Story 7.1):**

The tour should appear AFTER the startup animation completes. Modify App.tsx:

```typescript
// App.tsx - snippet showing tour integration
import { TourController } from '@/components/Layout/TourController';

export function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showTour, setShowTour] = useState(false);

  const handleSplashComplete = () => {
    setShowSplash(false);
    // Show tour after splash completes
    setTimeout(() => setShowTour(true), 300);
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      {!showSplash && showTour && <TourController />}
      {!showSplash && <AppShell />}
    </>
  );
}
```

**Data Attributes for Tour Targeting:**

Add data-tour attributes to existing components:

```typescript
// Example: Add to Collections Sidebar component
<div data-tour="collections-sidebar">
  {/* sidebar content */}
</div>

// Example: Add to Send button
<button data-tour="send-button">
  Send
</button>

// Example: Add to Settings/Environment toggle
<button data-tour="settings-env">
  Environment Settings
</button>
```

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Zustand for state management (consistent with project)
- Tailwind CSS v4 utility classes
- Selected tooltip library (react-joyride recommended)
- Vitest + React Testing Library for tests

**Component Conventions:**
- TourController in `src/components/Layout/`
- TourStore in `src/stores/`
- Tests co-located with source files
- Use existing Zustand patterns from other stores

**State Management:**
- Use Zustand with persist middleware for localStorage
- Follow existing store patterns (like settingsStore)
- Tour state should not block app functionality

### Integration Points

- **App.tsx**: Add TourController after splash screen
- **Settings panel**: Add "Restart Tutorial" button
- **Existing components**: Add data-tour attributes for targeting
- **localStorage**: Persist tour completion state

### Critical Implementation Guardrails

1. **Library compatibility**: Verify selected tooltip library works with React 18 and doesn't conflict with existing UI

2. **Timing integration**: Tour appears AFTER startup animation (Story 7.1) - use setTimeout delay

3. **Data-tour attributes**: Must be added to existing components BEFORE tour runs - verify all targets exist

4. **Persistence**: Tour state must persist across app restarts - use localStorage

5. **Skip functionality**: Tour must be dismissible via Escape key, click outside, or Skip button

6. **Restart capability**: Settings must have "Restart Tutorial" option that resets tour state

7. **Theme support**: Tooltip styling should respect light/dark theme (if library supports it)

8. **No regressions**: All existing functionality must work while tour is active

9. **5 key areas**: Tour must cover exactly the 5 areas listed in AC #2

### Previous Story Intelligence

**From Story 7.1 (Startup Animation):**
- SplashScreen component created in `src/components/Layout/`
- App.tsx updated with splash screen logic and onComplete callback pattern
- useTheme hook available for theme detection
- Animation timing: minDuration (1500ms), maxDuration (3000ms)
- App initializes concurrently while splash displays

**Integration Pattern for Tour:**
```typescript
// After Story 7.1, add tour delay
const handleSplashComplete = () => {
  setShowSplash(false);
  // Delay tour slightly to let main UI settle
  setTimeout(() => {
    useTourStore.getState().resetTour();
    setShowTour(true);
  }, 500);
};
```

**From Story 4.1 (Light/Dark Theme):**
- Theme system exists with light/dark modes
- Tooltip library should respect theme (or use neutral styling)

**From Story 6.5 (Settings in Sidebar Accordion):**
- Settings panel exists - add "Restart Tutorial" option here

### Testing Requirements

**Unit Tests (tourStore.test.ts):**

```typescript
// Test: Initial state is incomplete
const { result } = renderHook(() => useTourStore());
expect(result.current.hasCompletedTour).toBe(false);
expect(result.current.currentStep).toBe(0);

// Test: completeTour updates state
act(() => { result.current.completeTour(); });
expect(result.current.hasCompletedTour).toBe(true);

// Test: resetTour clears state
act(() => { result.current.resetTour(); });
expect(result.current.hasCompletedTour).toBe(false);
expect(result.current.currentStep).toBe(0);

// Test: persistence - state survives reload
act(() => { result.current.completeTour(); });
// Re-render should maintain state
const { result: result2 } = renderHook(() => useTourStore());
expect(result2.current.hasCompletedTour).toBe(true);
```

**Component Tests (TourController.test.tsx):**

```typescript
// Test: Tour renders when not completed
render(<TourController />);
// Joyride should be visible

// Test: Tour doesn't render when completed
const { result } = renderHook(() => useTourStore());
act(() => { result.current.completeTour(); });
render(<TourController />);
// Joyride should not render (null)
```

**Integration Tests:**

```typescript
// Test: Tour starts after splash animation completes
// Test: "Restart Tutorial" resets tour state in Settings
// Test: Escape key dismisses tour
// Test: Click outside dismisses tour
```

### Project Structure Notes

**New Files (create):**
- `src/components/Layout/TourController.tsx` (new)
- `src/components/Layout/TourController.test.tsx` (new)
- `src/stores/tourStore.ts` (new)
- `src/stores/tourStore.test.ts` (new)

**Modified Files:**
- `src/App.tsx` (add TourController after splash)
- Various components to add data-tour attributes:
  - CollectionTree/CollectionSidebar component
  - RequestBuilder component
  - Send button component
  - ResponseViewer component
  - Settings/Environment panel
- `src/components/Settings/Settings.tsx` (add restart button)

**Dependencies to Add:**
- Selected tooltip library (e.g., `react-joyride`)

### References

- **Primary Source**: `_bmad-output/planning-artifacts/epic-7.md` (Story 7.2 acceptance criteria)
- **Startup Animation**: Story 7.1 - tour should appear after splash completes
- **State Management**: Existing Zustand stores pattern
- **Settings Panel**: Story 6.5 - add restart option here
- **Theme System**: Story 4.1 - tooltip should respect theme
- **Testing**: Vitest + React Testing Library (consistent with project)
- **Tooltip Library Options**: react-joyride, reactour, driver.js

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

- Workflow: create-story (Story 7.2)
- Epic: 7 - First-Run Experience & Polish
- Previous Story: 7-1-startup-animation (in review - provides splash screen completion pattern)
- Auto-generated context engine analysis completed

### Completion Notes List

- Created comprehensive story context for Story 7.2 (Onboarding Tooltip Tutorial)
- Included all acceptance criteria with detailed implementation guidance
- Provided code examples for TourContext store, TourController component, and App integration
- Documented data-tour attribute requirements for 5 key UI areas
- Referenced existing project architecture and patterns from Story 7.1
- Set up testing requirements consistent with project standards
- Provided guardrails for library selection, persistence, skip/restart functionality
- **Implementation (dev-story):** Selected react-joyride@2.9.3 as tooltip library (React 18 compatible, TypeScript, active maintenance)
- Created `src/stores/tourStore.ts` with Zustand + persist middleware for localStorage persistence
- Created `src/components/Layout/TourController.tsx` with 5 tour steps covering all AC #2 areas
- Modified `src/App.tsx` to integrate TourController after splash screen with 500ms settle delay
- Added `data-tour` attributes to Sidebar (collections-sidebar, settings-env) and MainPanel (request-builder, send-button, response-panel)
- Added "Restart Tutorial" button in SettingsPanel.tsx, wired to tourStore.resetTour()
- Wrote 5 unit tests for tourStore and 12 component tests for TourController (17 new tests total)
- All 492 tests pass, TypeScript compiles clean

## File List

- `src/stores/tourStore.ts` (new)
- `src/stores/tourStore.test.ts` (new)
- `src/components/Layout/TourController.tsx` (new)
- `src/components/Layout/TourController.test.tsx` (new)
- `src/App.tsx` (modified - added TourController integration)
- `src/components/Sidebar/Sidebar.tsx` (modified - added data-tour attributes)
- `src/components/MainPanel/MainPanel.tsx` (modified - added data-tour attributes)
- `src/components/Settings/SettingsPanel.tsx` (modified - added Restart Tutorial button)
- `package.json` (modified - added react-joyride dependency)
- `package-lock.json` (modified - dependency lockfile update)

## Change Log

- 2026-03-11: Story 7.2 implemented - Onboarding Tooltip Tutorial with react-joyride, TourStore (Zustand persist), TourController component, data-tour attributes on 5 UI areas, Restart Tutorial in Settings, 17 new tests
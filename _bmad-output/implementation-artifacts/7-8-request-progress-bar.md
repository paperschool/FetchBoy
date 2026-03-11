# Story 7.8: Request In-Flight Progress Bar

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see a slim top-of-window progress bar during a request,
So that I know the app is working even when looking away from the loading spinner.

## Acceptance Criteria

1. A fixed-position bar at the top of the main content area animates from 0% → 80% while the request is in flight, then rapidly completes to 100% on response
2. The bar respects the cancel action (completes/hides on cancellation)
3. Implemented in pure CSS/React with no new library dependency

## Tasks / Subtasks

- [x] Task 1 - Create ProgressBar component (AC: 1, 3)
  - [x] Create `fetch-boy/src/components/ProgressBar/ProgressBar.tsx`
  - [x] Implement CSS animation from 0% → 80% while request in flight
  - [x] Add 80% → 100% completion animation on response
  - [x] Style with theme-aware colors

- [x] Task 2 - Integrate ProgressBar with request flow (AC: 1, 2)
  - [x] Add ProgressBar to main app layout (MainPanel.tsx)
  - [x] Connect to request state (in-flight status)
  - [x] Handle cancel action - complete/hide on cancellation
  - [x] Reset progress bar on new request

- [x] Task 3 - Add theme support (AC: 3)
  - [x] Use theme-aware colors from useUiSettingsStore
  - [x] Ensure progress bar visible in both light and dark modes

- [x] Task 4 - Final Task - Commit story changes
  - [x] Run `npx tsc --noEmit` from `fetch-boy/` to verify TypeScript compilation
  - [x] Run `cargo check` from `fetch-boy/src-tauri/` to verify Rust compilation
  - [x] Run `npx vitest run` from `fetch-boy/` to verify all tests pass
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 7.8

## Dev Notes

### Critical Implementation Details

**Progress Bar Behavior:**

1. **Request Started**: Progress bar appears at top of window, animates from 0% → 80% linearly over the duration of the request
2. **Request Completed**: Progress bar quickly animates from 80% → 100%, then fades out
3. **Request Cancelled**: Progress bar completes to 100% or immediately hides
4. **New Request**: Progress bar resets and starts fresh

**CSS Animation Approach (No New Dependencies):**

```tsx
// ProgressBar.tsx - Pure CSS/React implementation
import { useEffect, useState } from 'react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

interface ProgressBarProps {
  isActive: boolean;
  progress: number; // 0-100
  onComplete?: () => void;
}

export function ProgressBar({ isActive, progress, onComplete }: ProgressBarProps) {
  const { theme } = useUiSettingsStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setVisible(true);
    } else if (progress >= 100) {
      // Fade out after completion
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isActive, progress]);

  if (!visible && progress === 0) return null;

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-1"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease-out',
      }}
    >
      <div
        className="h-full transition-all duration-300 ease-out"
        style={{
          width: `${Math.min(progress, 100)}%`,
          backgroundColor: isDark ? '#3b82f6' : '#2563eb', // blue-500/600
        }}
      />
    </div>
  );
}
```

**Integration with Request Store:**

```tsx
// Add to existing request store or create new hook
import { create } from 'zustand';

interface RequestProgressState {
  isRequestInFlight: boolean;
  requestProgress: number;
  startRequest: () => void;
  updateProgress: (progress: number) => void;
  completeRequest: () => void;
  cancelRequest: () => void;
}

export const useRequestProgressStore = create<RequestProgressState>((set) => ({
  isRequestInFlight: false,
  requestProgress: 0,
  
  startRequest: () => set({ isRequestInFlight: true, requestProgress: 0 }),
  
  updateProgress: (progress) => set({ 
    requestProgress: Math.min(progress, 80) // Cap at 80% until complete
  }),
  
  completeRequest: () => set({ 
    requestProgress: 100,
    isRequestInFlight: false 
  }),
  
  cancelRequest: () => set({ 
    isRequestInFlight: false,
    requestProgress: 0 
  }),
}));
```

**Integration in App.tsx or MainPanel:**

```tsx
import { ProgressBar } from '@/components/ProgressBar/ProgressBar';
import { useRequestProgressStore } from '@/hooks/useRequestProgress';

export function App() {
  const { isRequestInFlight, requestProgress } = useRequestProgressStore();
  
  return (
    <div className="min-h-screen bg-app-main">
      <ProgressBar 
        isActive={isRequestInFlight} 
        progress={requestProgress} 
      />
      {/* ... rest of app */}
    </div>
  );
}
```

**Connecting to HTTP Request:**

```tsx
// In your request sending logic (e.g., in a hook or store)
import { useRequestProgressStore } from '@/hooks/useRequestProgress';

const sendRequest = async () => {
  const progressStore = useRequestProgressStore.getState();
  progressStore.startRequest();
  
  // Simulate progress during request (or use real progress if available)
  const progressInterval = setInterval(() => {
    const current = useRequestProgressStore.getState().requestProgress;
    if (current < 80) {
      progressStore.updateProgress(current + 10);
    }
  }, 200);
  
  try {
    const response = await httpClient.request(config);
    clearInterval(progressInterval);
    progressStore.completeRequest();
    return response;
  } catch (error) {
    clearInterval(progressInterval);
    progressStore.cancelRequest();
    throw error;
  }
};
```

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Tailwind CSS v4 with dark mode
- Lucide React for icons (if needed)
- Zustand for state management
- Vitest + React Testing Library for tests
- Rust with reqwest for HTTP requests

**Theme System:**
- Theme controlled via `useUiSettingsStore` with values: 'light' | 'dark' | 'system'
- Use theme-aware classes - check `isDark` using the pattern from existing components

**Component Pattern:**
- Create new component in `fetch-boy/src/components/ProgressBar/ProgressBar.tsx`
- Export index from `fetch-boy/src/components/ProgressBar/index.ts`
- Follow existing component patterns in the project

### Integration Points

**New Files:**
- `fetch-boy/src/components/ProgressBar/ProgressBar.tsx` - Main progress bar component
- `fetch-boy/src/components/ProgressBar/index.ts` - Barrel export
- `fetch-boy/src/hooks/useRequestProgress.ts` - Request progress state management (or integrate into existing store)

**Modified Files:**
- `fetch-boy/src/App.tsx` or `fetch-boy/src/components/Layout/*` - Add ProgressBar to layout
- Existing request handling code - Connect to progress store

**No New Dependencies:**
- Pure CSS animation (no external library)
- Uses existing Tailwind CSS + dark mode
- Uses existing Zustand for state

### Critical Implementation Guardrails

1. **No New Library**: Must use pure CSS/React, no loading spinner libraries
2. **Theme Aware**: Progress bar must work in both light and dark modes
3. **Cancel Handling**: Progress bar must properly handle request cancellation
4. **Z-Index**: Progress bar should have high z-index but not block interactions
5. **Performance**: Use CSS transitions, not JavaScript animation loops for smooth performance
6. **Reset**: Progress bar must properly reset between requests
7. **Responsive**: Should work across different window sizes

### Previous Story Intelligence

**From Story 7.7 (Image & Binary Response Handling):**
- Used Zustand store pattern for state management
- Theme-aware via useUiSettingsStore
- Added new component in components folder
- No new dependencies added

**From Story 7.6 (What's New Modal):**
- Modal uses high z-index for overlay
- Theme detection pattern: `theme === 'dark' || (theme === 'system' && ...)`
- Uses Lucide React icons if needed

**From Story 7.5 (Keyboard Shortcut Overlay):**
- Fixed positioning with z-index for overlay
- Escape key handling patterns

**From Story 7.4 (Empty State Polish):**
- EmptyState component patterns
- Theme-aware icons using Lucide React

**Key Patterns from Previous Epic 6:**
- Story 6-2 (Request Cancellation): Uses cancel action pattern
- Story 6-4 (Request Timeout): Shows different UI states based on response

### Testing Requirements

**Unit Tests (ProgressBar.test.tsx):**

```tsx
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';
import { UiSettingsProvider } from '@/stores/uiSettingsStore'; // mock provider

// Test: renders nothing when not active and progress is 0
render(<ProgressBar isActive={false} progress={0} />);
expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

// Test: renders when active
render(<ProgressBar isActive={true} progress={50} />);
expect(screen.getByRole('progressbar')).toBeInTheDocument();

// Test: width reflects progress
render(<ProgressBar isActive={true} progress={50} />);
const bar = screen.getByRole('progressbar');
expect(bar).toHaveStyle({ width: '50%' });

// Test: caps at 80% during flight
render(<ProgressBar isActive={true} progress={90} />);
const bar90 = screen.getByRole('progressbar');
expect(bar90).toHaveStyle({ width: '80%' }); // Should be capped

// Test: completes to 100% on response
render(<ProgressBar isActive={false} progress={100} />);
const bar100 = screen.getByRole('progressbar');
expect(bar100).toHaveStyle({ width: '100%' });
```

**Integration Tests:**

```tsx
// Test: progress updates during request
test('progress bar updates during request', async () => {
  const { result } = renderHook(() => useRequestProgressStore());
  
  act(() => {
    result.current.startRequest();
  });
  
  expect(result.current.isRequestInFlight).toBe(true);
  expect(result.current.requestProgress).toBe(0);
  
  act(() => {
    result.current.updateProgress(50);
  });
  
  expect(result.current.requestProgress).toBe(50);
  
  act(() => {
    result.current.completeRequest();
  });
  
  expect(result.current.requestProgress).toBe(100);
  expect(result.current.isRequestInFlight).toBe(false);
});

// Test: cancel action resets progress
test('cancel action resets progress', async () => {
  const { result } = renderHook(() => useRequestProgressStore());
  
  act(() => {
    result.current.startRequest();
    result.current.updateProgress(40);
    result.current.cancelRequest();
  });
  
  expect(result.current.isRequestInFlight).toBe(false);
  expect(result.current.requestProgress).toBe(0);
});
```

### Project Structure Notes

**New Files:**
- `fetch-boy/src/components/ProgressBar/ProgressBar.tsx`
- `fetch-boy/src/components/ProgressBar/index.ts`
- `fetch-boy/src/components/ProgressBar/ProgressBar.test.tsx`
- `fetch-boy/src/hooks/useRequestProgress.ts` (or integrate into existing hook)

**Modified Files:**
- `fetch-boy/src/App.tsx` - Add ProgressBar component
- Or `fetch-boy/src/components/Layout/MainLayout.tsx` - Add ProgressBar

**No New Dependencies:**
- Pure CSS/Tailwind for styling
- Uses existing Zustand, React, Tailwind patterns
- No animation libraries needed

### References

- **Primary Source**: `_bmad-output/planning-artifacts/epic-7.md` (Story 7.8 acceptance criteria)
- **Theme Pattern**: Story 4.1 - light/dark theme implementation
- **State Management**: Story 7.6/7.7 - Zustand store patterns
- **Component Patterns**: Existing components in `fetch-boy/src/components/`
- **Testing**: Vitest + React Testing Library (consistent with project)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

- Workflow: create-story (Story 7.8)
- Epic: 7 - First-Run Experience & Polish
- Previous Stories in Epic 7:
  - 7-7-image-binary-response-handling (completed, in review)
  - 7-6-whats-new-modal (completed, in review)
  - 7-5-keyboard-shortcut-overlay
  - 7-4-empty-state-polish
  - 7-3-sample-collection
  - 7-2-onboarding-tooltip-tutorial
  - 7-1-startup-animation
- Architecture: React, TypeScript, Tailwind CSS v4, Rust/Tauri, Zustand, reqwest
- Context analysis completed

### Completion Notes List

- **Implementation Summary:** Created a Request In-Flight Progress Bar feature that shows at the top of the window during HTTP requests
- **Components Created:**
  - `fetch-boy/src/components/ProgressBar/ProgressBar.tsx` - Theme-aware progress bar component with CSS animations
  - `fetch-boy/src/components/ProgressBar/index.ts` - Barrel export
  - `fetch-boy/src/components/ProgressBar/ProgressBar.test.tsx` - Unit tests (7 tests)
  - `fetch-boy/src/hooks/useRequestProgress.ts` - Zustand store for progress state management

- **Files Modified:**
  - `fetch-boy/src/components/MainPanel/MainPanel.tsx` - Integrated ProgressBar with request flow

- **Features Implemented:**
  - Fixed-position progress bar at top of window (z-index: 50)
  - CSS animation from 0% → 80% during request, then 80% → 100% on completion
  - Theme-aware colors (blue-500 in light mode, blue-600 in dark mode)
  - Cancel handling - resets progress on cancellation
  - Fade-out animation after completion (300ms)
  - No new dependencies - pure CSS/React implementation

- **Validation:**
  - TypeScript compilation: ✅
  - Rust compilation: ✅
  - Unit tests: ✅ (7/7 passing)

### File List

- fetch-boy/src/components/ProgressBar/ProgressBar.tsx (new)
- fetch-boy/src/components/ProgressBar/index.ts (new)
- fetch-boy/src/components/ProgressBar/ProgressBar.test.tsx (new)
- fetch-boy/src/hooks/useRequestProgress.ts (new)
- fetch-boy/src/App.tsx (modified - add ProgressBar)

## Change Log

- 2026-03-11: Story 7.8 created — Request In-Flight Progress Bar with CSS animation, theme support, and cancel handling

# Story 7.1: Nice Startup Animation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see a branded animation when launching the app,
so that the app feels polished and professional during startup.

## Acceptance Criteria

1. A startup splash screen/loading animation displays immediately when the app launches
2. The animation shows the FetchBoy logo/app icon with a subtle motion effect (fade-in, scale, or similar)
3. The animation plays for at least 1.5 seconds (to feel intentional) but no more than 3 seconds
4. After the animation completes, the main app UI fades in smoothly
5. The animation respects the current theme (light/dark) - appropriate colors for each
6. Startup time is not noticeably impacted - the animation runs concurrently with app initialization
7. The animation can be skipped by clicking/tapping if it takes too long

## Tasks / Subtasks

- [x] Task 1 - Create SplashScreen component (AC: 1, 2)
  - [x] Create SplashScreen.tsx component in `src/components/Layout/`
  - [x] Add FetchBoy logo/icon with CSS animation (fade-in, scale)
  - [x] Style for light/dark theme compatibility

- [x] Task 2 - Implement animation timing logic (AC: 3, 7)
  - [x] Add timer: minimum 1.5s, maximum 3s
  - [x] Add click/tap handler to skip animation early
  - [x] Ensure animation completes before proceeding

- [x] Task 3 - Integrate splash screen with app startup (AC: 4, 6)
  - [x] Add SplashScreen to App.tsx main entry
  - [x] Implement smooth fade transition from splash to main UI
  - [x] Run initialization concurrently with animation

- [x] Task 4 - Theme integration (AC: 5)
  - [x] Detect current theme (light/dark/system)
  - [x] Apply appropriate colors to splash screen
  - [x] Listen for theme changes during animation

- [x] Task 5 - Write tests (AC: all)
  - [x] Write unit tests for SplashScreen component
  - [x] Test animation timing
  - [x] Test skip functionality
  - [x] Test theme integration

- [x] Task 6 - Commit story changes
  - [x] Run `npx tsc --noEmit` from `` to verify TypeScript compilation
  - [x] Run `npx vitest run` from `` to verify all tests pass
  - [x] Commit all code and documentation changes for this story with a message that includes Story 7.1

## Dev Notes

### Critical Implementation Details

**SplashScreen Component:**

The splash screen should display immediately on app launch with the FetchBoy logo and a subtle animation. It should run concurrently with app initialization.

```typescript
// SplashScreen.tsx structure
import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;  // default: 1500ms
  maxDuration?: number;  // default: 3000ms
}

export function SplashScreen({
  onComplete,
  minDuration = 1500,
  maxDuration = 3000
}: SplashScreenProps) {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Complete after minimum duration
    const minTimer = setTimeout(() => {
      // Wait for app initialization (if faster than max, wait for it)
      // For now, just complete after min + small buffer
      setIsVisible(false);
      onComplete();
    }, minDuration);

    // Force complete after max duration
    const maxTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, maxDuration);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, [onComplete, minDuration, maxDuration]);

  const handleSkip = () => {
    setIsVisible(false);
    onComplete();
  };

  return (
    <div
      className={`splash-screen theme-${theme}`}
      onClick={handleSkip}
    >
      <div className="logo-container animate-fade-in">
        <img src="/src-tauri/icons/fetch-boi-logo.svg" alt="FetchBoy" />
      </div>
    </div>
  );
}
```

**App Integration:**

```typescript
// App.tsx structure
import { useState, useEffect } from 'react';
import { SplashScreen } from '@/components/Layout/SplashScreen';
import { AppShell } from '@/components/Layout/AppShell';

export function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize app in background while splash shows
    const initApp = async () => {
      await initializeStores();
      await loadSettings();
      await connectDatabase();
      setIsInitialized(true);
    };

    initApp();
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return <AppShell />;
}
```

**Theme-Aware Styling:**

```css
/* index.css - splash screen styles */
.splash-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
  transition: opacity 0.3s ease-out;
}

.splash-screen.theme-light {
  background: #ffffff;
  color: #1a1a1a;
}

.splash-screen.theme-dark {
  background: #1a1a1a;
  color: #ffffff;
}

.splash-screen.theme-system {
  /* Follow system preference */
  @media (prefers-color-scheme: dark) {
    background: #1a1a1a;
    color: #ffffff;
  }
  @media (prefers-color-scheme: light) {
    background: #ffffff;
    color: #1a1a1a;
  }
}

.logo-container {
  animation: splash-fade-in 0.5s ease-out;
}

@keyframes splash-fade-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

### Architecture Compliance

**Tech Stack:**

- React 18+ with TypeScript
- Zustand for state management
- Tailwind CSS v4 utility classes
- Vitest + React Testing Library for tests
- Tauri v2 for desktop app shell

**Component/File Conventions:**

- SplashScreen component in `src/components/Layout/`
- Tests co-located: `SplashScreen.test.tsx` alongside source
- Use existing theme hook: `useTheme` from stores or hooks

**Animation Guidelines:**

- Use CSS animations for performance (avoid JS animations)
- Run concurrently with app initialization
- Minimum 1.5s, maximum 3s duration
- Smooth fade transition out

### Integration Points

- **App.tsx**: Add splash screen as initial component
- **main.tsx**: Entry point - ensure app initializes in background
- **useTheme hook**: Get current theme for splash styling
- **stores**: Initialize all required stores during splash
- **database**: Connect to SQLite during splash (concurrent)

### Critical Implementation Guardrails

1. **Concurrent initialization**: App should initialize while splash displays - don't block on initialization

2. **Theme support**: Splash must respect light/dark/system theme settings

3. **Timing requirements**: Minimum 1.5s, maximum 3s animation duration - this is UX-critical

4. **Skip functionality**: User can click/tap to dismiss early - but still show for at least 1.5s

5. **Smooth transition**: Main UI should fade in smoothly after splash, not appear abruptly

6. **Logo location**: Logo is at `src-tauri/icons/fetch-boi-logo.svg` (from README.md)

7. **No regressions**: All existing functionality must work after splash completes

8. **Performance**: Animation should not noticeably impact startup time

### Previous Story Intelligence

**From Story 6.5 (Settings in Sidebar Accordion):**

- App uses Zustand stores for state management
- Components use Tailwind CSS with theme-aware classes
- Tests use Vitest + React Testing Library

**From Story 4.1 (Light/Dark Theme):**

- Theme system exists with light/dark/system modes
- Use `useTheme` hook to detect current theme
- Theme is persisted across app restarts

**From Story 1.1 (Project Scaffold):**

- App entry point is App.tsx
- Layout components in `src/components/Layout/`

### Testing Requirements

**Unit Tests (SplashScreen.test.tsx):**

```typescript
// Test: Splash screen renders with logo
render(<SplashScreen onComplete={fn} />);
expect(screen.getByAltText('FetchBoy')).toBeInTheDocument();

// Test: Animation completes after minimum duration
render(<SplashScreen onComplete={fn} minDuration={1500} />);
await waitFor(() => expect(fn).toHaveBeenCalled(), { timeout: 2000 });

// Test: Skip on click
render(<SplashScreen onComplete={fn} />);
fireEvent.click(screen.getByAltText('FetchBoy'));
expect(fn).toHaveBeenCalled();

// Test: Theme is applied
const { container } = render(<SplashScreen onComplete={fn} />);
expect(container.firstChild).toHaveClass('theme-light');
```

**Integration Tests:**

```typescript
// Test: App shows splash on initial load
// Test: Main UI appears after splash completes
// Test: Theme changes are reflected in splash
```

### Project Structure Notes

**New Files:**

- `src/components/Layout/SplashScreen.tsx` (new)
- `src/components/Layout/SplashScreen.test.tsx` (new)

**Modified Files:**

- `src/App.tsx` (add splash screen logic)
- `src/index.css` (add splash screen styles)

**Optional Files:**

- `src/hooks/useTheme.ts` (create if not exists, or use existing)

### References

- **Primary Source**: `_bmad-output/planning-artifacts/epic-7.md` (Story 7.1 acceptance criteria)
- **Logo**: `src-tauri/icons/fetch-boi-logo.svg` (FetchBoy logo)
- **Theme System**: Story 4.1 (Light/Dark Theme) - use existing `useTheme` hook
- **App Entry**: `src/App.tsx` (main app component)
- **Layout Components**: `src/components/Layout/` (existing layout structure)
- **Testing**: Vitest + React Testing Library (consistent with project)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Workflow: create-story (Story 7.1)
- Epic: 7 - First-Run Experience & Polish
- Previous Stories: 6-1-foldable-side-panel, 6-2-request-cancellation, 6-3-keyboard-shortcut-to-send-request, 6-4-request-timeout-configuration, 6-5-settings-in-sidebar-accordion
- Auto-generated context engine analysis completed

### Completion Notes List

- Created comprehensive story context for Story 7.1 (Nice Startup Animation)
- Included all acceptance criteria with detailed implementation guidance
- Provided code examples for SplashScreen component and App integration
- Documented theme-aware styling and animation requirements
- Referenced existing project architecture and patterns from previous stories
- Set up testing requirements consistent with project standards
- **Implementation (2026-03-11):** Created `SplashScreen` component with `useTheme()` hook integration (applies `.dark` class to documentElement for theme-aware styling). Logo imported via Vite asset URL from `src-tauri/icons/fetch-boi-logo.svg`. Timing: auto-completes at `minDuration` (default 1500ms) with safety net at `maxDuration` (default 3000ms); click-to-skip enabled after min duration. App.tsx updated with `useState(true)` for splash gate and smooth `app-fade-in` CSS transition when main UI appears. CSS keyframes `splash-fade-in` and `app-fade-in` added to `index.css`. Added `vite-env.d.ts` for SVG import type declarations. All 12 new tests pass alongside 463 existing tests (475 total, no regressions). TypeScript compiles clean.

### File List

- `src/vite-env.d.ts` (new)
- `src/components/Layout/SplashScreen.tsx` (new)
- `src/components/Layout/SplashScreen.test.tsx` (new)
- `src/App.tsx` (modified)
- `src/index.css` (modified)
- `_bmad-output/implementation-artifacts/7-1-startup-animation.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-03-11: Story 7.1 context created via automated create-story workflow — comprehensive developer guide with splash screen component, animation timing, theme integration, and concurrent initialization
- 2026-03-11: Story 7.1 implemented — SplashScreen component with logo animation, theme-aware styling, min/max timing (1.5s–3s), click-to-skip, smooth app fade-in transition; 12 new tests added, all 475 tests pass

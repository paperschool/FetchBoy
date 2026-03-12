# Story 8.4: Tab Component Abstraction & Test Fixes

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer maintaining FetchBoy,
I want to abstract common tab layout components and fix broken tests,
so that the codebase follows DRY/SRP principles and has full test coverage.

## Acceptance Criteria

1. Abstract `AppTopBar` component created that both `TopBar` and `InterceptTopBar` can extend
2. Abstract `AppSidebar` component created that both `Sidebar` and `InterceptSidebar` can extend
3. Abstract `TabLayout` component created for common tab shell layout
4. All tourStore and TourController tests fixed (storage.setItem mock issues)
5. All tests pass with proper coverage
6. Logical component naming following established patterns
7. Run `npx tsc --noEmit` and `cargo check` with no errors

## Tasks / Subtasks

### Phase 1: Test Fixes

- [x] Task 1 - Fix tourStore tests (AC: 4)
  - [x] Examine `fetch-boy/src/stores/tourStore.ts` for localStorage usage
  - [x] Update test setup to mock localStorage properly
  - [x] Run tests to verify fixes

- [x] Task 2 - Fix TourController tests (AC: 4)
  - [x] Examine `fetch-boy/src/components/Layout/TourController.tsx`
  - [x] Update test mocks to handle localStorage
  - [x] Run tests to verify fixes

### Phase 2: Component Abstraction

- [x] Task 3 - Create Abstract TopBar Component (AC: 1, 2)
  - [x] Create `fetch-boy/src/components/Layout/AppTopBar.tsx`
  - [x] Extract common props: title, logo/icon, actions
  - [x] Refactor `TopBar.tsx` to use AppTopBar
  - [x] Refactor `InterceptTopBar.tsx` to use AppTopBar

- [x] Task 4 - Create Abstract Sidebar Component (AC: 2)
  - [x] Create `fetch-boy/src/components/Layout/AppSidebar.tsx`
  - [x] Extract common props: collapsed, onToggle, collapseButton
  - [x] Handle panel-specific content via children render prop
  - [x] Refactor `Sidebar.tsx` to use AppSidebar
  - [x] Refactor `InterceptSidebar.tsx` to use AppSidebar

- [x] Task 5 - Create TabLayout Component (AC: 3)
  - [x] Create `fetch-boy/src/components/Layout/TabLayout.tsx`
  - [x] Extract common grid layout pattern from FetchView and InterceptView
  - [x] Props: topBar, sidebar, mainContent, sidebarCollapsed, onToggleSidebar
  - [x] Refactor `FetchView.tsx` to use TabLayout
  - [x] Refactor `InterceptView.tsx` to use TabLayout

- [x] Task 6 - Final Task - Commit story changes
  - [x] Run `npx tsc --noEmit` from `fetch-boy/` to verify TypeScript compilation
  - [x] Run `cargo check` from `fetch-boy/src-tauri/` to verify Rust compilation
  - [x] Run `npx vitest run` from `fetch-boy/` to verify all tests pass
  - [x] Commit all code and documentation changes for this story with a message that includes Story 8.4

## Dev Notes

### Current Component Analysis

**FetchView.tsx (48 lines):**

```tsx
// Uses: TopBar, Sidebar, MainPanel, TabBar
// Layout: grid with 3 rows, collapsible sidebar
```

**InterceptView.tsx (70 lines):**

```tsx
// Uses: InterceptTopBar, InterceptSidebar, InterceptTable
// Layout: same grid pattern as FetchView
// Differences:
//   - TopBar is simpler (no environment selector)
//   - Sidebar has proxy settings instead of collections/history
//   - Main content shows empty state or InterceptTable
```

**Common Grid Pattern:**

```tsx
<div
  className={`grid h-full ${
    sidebarCollapsed ? "grid-cols-[3.5rem_1fr]" : "grid-cols-[16rem_1fr]"
  } grid-rows-[3rem_2.25rem_1fr] overflow-hidden ...`}
>
  <TopBar />
  <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
  <div className="col-start-2 row-start-2">TabBar or InterceptTable</div>
  <MainPanel />
</div>
```

### Current TopBar Components

**TopBar.tsx (40 lines):**

- Title: "Fetch Boy 🦴"
- Environment selector dropdown
- Environment panel button

**InterceptTopBar.tsx (12 lines):**

- Title: "Intercept Boy 🛡️"
- No other elements

### Current Sidebar Components

**Sidebar.tsx (120+ lines):**

- Collections/History toggle
- CollectionTree or HistoryPanel
- Settings accordion
- Collapse button

**InterceptSidebar.tsx (120+ lines):**

- Proxy status indicator
- Proxy enable/disable toggle
- Proxy port configuration
- CA certificate management
- Settings accordion
- Collapse button

### Proposed Abstract Components

**1. AppTopBar.tsx:**

```typescript
// components/Layout/AppTopBar.tsx
interface AppTopBarProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function AppTopBar({ title, icon, actions, className }: AppTopBarProps) {
  return (
    <header
      data-testid="top-bar"
      className={`bg-app-topbar text-app-inverse col-span-2 flex h-12 items-center justify-between px-4 ${className ?? ''}`}
    >
      <span className="text-lg font-semibold tracking-wide">
        {icon && <span className="mr-2">{icon}</span>}
        {title}
      </span>
      {actions}
    </header>
  );
}
```

**2. AppSidebar.tsx:**

```typescript
// components/Layout/AppSidebar.tsx
interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function AppSidebar({ collapsed, onToggle, children, className }: AppSidebarProps) {
  if (collapsed) {
    return (
      <aside className={`bg-app-sidebar flex flex-col items-center py-2 gap-2 ${className ?? ''}`}>
        <button onClick={onToggle} className="p-2 hover:bg-gray-700 rounded transition-colors" title="Expand sidebar">
          <ChevronRight size={18} className="text-app-muted" />
        </button>
        <div className="flex-1" />
      </aside>
    );
  }

  return (
    <aside className={`bg-app-sidebar flex flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <button onClick={onToggle} className="p-1 hover:bg-gray-700 rounded transition-colors" title="Collapse sidebar">
          <ChevronLeft size={16} className="text-app-muted" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
    </aside>
  );
}
```

**3. TabLayout.tsx:**

```typescript
// components/Layout/TabLayout.tsx
interface TabLayoutProps {
  topBar: React.ReactNode;
  sidebar: React.ReactNode;
  middleContent?: React.ReactNode;
  mainContent: React.ReactNode;
  sidebarCollapsed: boolean;
}

export function TabLayout({ topBar, sidebar, middleContent, mainContent, sidebarCollapsed }: TabLayoutProps) {
  return (
    <div
      className={`grid h-full ${
        sidebarCollapsed ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[16rem_1fr]'
      } grid-rows-[3rem_2.25rem_1fr] overflow-hidden transition-[grid-template-columns] duration-200 ease-in-out [&>aside]:row-span-2 [&>main]:col-start-2 [&>main]:row-start-3`}
    >
      {topBar}
      {sidebar}
      {middleContent && <div className="col-start-2 row-start-2 border-b border-app-subtle bg-app-sidebar overflow-hidden">{middleContent}</div>}
      {mainContent}
    </div>
  );
}
```

### Test Setup Fixes

The tourStore tests fail because they don't mock localStorage. The tests need a proper setup:

```typescript
// test/setup.ts should include:
beforeAll(() => {
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  vi.stubGlobal("localStorage", localStorageMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});
```

Or mock at test level:

```typescript
beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });
});
```

### Architecture Compliance

**Tech Stack:**

- React 18+ with TypeScript
- Tailwind CSS v4 with dark mode
- Vitest + React Testing Library for tests

**Component Pattern:**

- Follow existing component patterns in `fetch-boy/src/components/Layout/`
- Use barrel exports
- Props interfaces with component files

**Naming Conventions:**

- Layout components: `AppTopBar`, `AppSidebar`, `TabLayout`
- Feature-specific: `FetchTopBar` (alias for TopBar), `InterceptTopBar`

### Integration Points

**New Files:**

- `fetch-boy/src/components/Layout/AppTopBar.tsx` - Abstract top bar
- `fetch-boy/src/components/Layout/AppSidebar.tsx` - Abstract sidebar
- `fetch-boy/src/components/Layout/TabLayout.tsx` - Abstract tab layout

**Modified Files:**

- `fetch-boy/src/components/TopBar/TopBar.tsx` - Use AppTopBar
- `fetch-boy/src/components/Intercept/InterceptTopBar.tsx` - Use AppTopBar
- `fetch-boy/src/components/Sidebar/Sidebar.tsx` - Use AppSidebar
- `fetch-boy/src/components/Intercept/InterceptSidebar.tsx` - Use AppSidebar
- `fetch-boy/src/components/FetchView/FetchView.tsx` - Use TabLayout
- `fetch-boy/src/components/Intercept/InterceptView.tsx` - Use TabLayout

**Test Files:**

- `fetch-boy/src/stores/tourStore.test.ts` - Fix localStorage mock
- `fetch-boy/src/components/Layout/TourController.test.tsx` - Fix localStorage mock

### Critical Implementation Guardrails

1. **Backward Compatibility:** All existing functionality must work exactly as before
2. **No Breaking Changes:** External imports should not need updates
3. **Test Coverage:** All new components need tests
4. **Type Safety:** Full TypeScript coverage

### Testing Requirements

**Unit Tests:**

1. Test AppTopBar renders with all props
2. Test AppSidebar collapsed and expanded states
3. Test TabLayout renders all children correctly

**Integration Tests:**

1. Test FetchView still works with TabLayout
2. Test InterceptView still works with TabLayout
3. Test all tour tests pass after localStorage mock fix

### References

- **Code Styling Standards**: `_bmad/_memory/tech-writer-sidecar/code-styling-standards.md`
- **DRY Principle**: Abstract common patterns into reusable components
- **SRP**: Each component has single responsibility

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

- Workflow: create-story (Story 8.4)
- Epic: 8 - Code Quality & Styling Compliance
- Previous Stories: 8-1, 8-2, 8-3 (refactoring)
- User Request: Abstract Fetch components for Intercept tab + fix tests
- Test Status: 17 tests failing (tourStore + TourController)
- MainPanel.tsx: 600+ lines (needs refactoring)

### Completion Notes List

- Story 8.1 (MainPanel refactoring) should be implemented first
- Story 8.2 (ResponseViewer refactoring) should be implemented second
- Story 8.3 (Settings/Auth refactoring) should be implemented third
- Story 8.4 (component abstraction) builds on above

### File List

- fetch-boy/src/components/Layout/AppTopBar.tsx (new)
- fetch-boy/src/components/Layout/AppSidebar.tsx (new)
- fetch-boy/src/components/Layout/TabLayout.tsx (new)
- fetch-boy/src/components/TopBar/TopBar.tsx (modified - use AppTopBar)
- fetch-boy/src/components/Intercept/InterceptTopBar.tsx (modified - use AppTopBar)
- fetch-boy/src/components/Sidebar/Sidebar.tsx (modified - use AppSidebar)
- fetch-boy/src/components/Intercept/InterceptSidebar.tsx (modified - use AppSidebar)
- fetch-boy/src/components/FetchView/FetchView.tsx (modified - use TabLayout)
- fetch-boy/src/components/Intercept/InterceptView.tsx (modified - use TabLayout)
- fetch-boy/src/stores/tourStore.test.ts (modified - fix localStorage mock)
- fetch-boy/src/components/Layout/TourController.test.tsx (modified - fix localStorage mock)

## Change Log

- 2026-03-12: Story 8.4 created — Tab Component Abstraction & Test Fixes

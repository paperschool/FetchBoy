# Story 6.3: Keyboard Shortcut to Send Request

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to send the current request using a keyboard shortcut,
so that I never have to reach for the mouse mid-workflow when iterating quickly.

## Acceptance Criteria

1. `Cmd/Ctrl + Enter` triggers the Send action for the active tab from anywhere within the request builder (URL bar, headers table, body editor, params tab, auth panel)
2. The shortcut does not fire if a modal, dropdown, or dialog is open
3. The shortcut is documented in the keyboard shortcut overlay (introduced in Story 5.4)
4. If a request is already in-flight, `Cmd/Ctrl + Enter` has no effect (does not cancel or re-send)
5. No regression: Enter inside the Monaco body editor inserts a newline as normal — only `Cmd/Ctrl + Enter` sends

## Tasks / Subtasks

- [x] Task 1 - Create keyboard shortcut hook for sending requests (AC: 1, 4, 5)
  - [x] Create `useSendRequestKeyboardShortcut.ts` hook in `src/hooks/`
  - [x] Add event listener for `keydown` that detects `Cmd/Ctrl + Enter` combination
  - [x] Check `isSending` state before triggering send (reject if already sending)
  - [x] Check that no modal/dropdown is open before triggering send
  - [x] Check that user is not inside Monaco editor (except for Cmd/Ctrl + Enter which should still work)
  - [x] Call the send request function when shortcut is triggered

- [x] Task 2 - Integrate hook into App component (AC: 1)
  - [x] Import and call `useSendRequestKeyboardShortcut()` in `src/App.tsx` or MainPanel
  - [x] Ensure the hook has access to the send request functionality

- [x] Task 3 - Handle Monaco editor special case (AC: 5)
  - [x] Detect if focus is inside Monaco editor using `document.activeElement?.closest('.monaco-editor')`
  - [x] When in Monaco editor: only trigger send if Cmd/Ctrl is pressed (regular Enter should insert newline)
  - [x] Test that regular Enter still inserts newlines in body editor

- [x] Task 4 - Handle modal/dropdown blocking (AC: 2)
  - [x] Check for open modals by looking for elements with role="dialog" or common modal class names
  - [x] Check for open dropdowns/selects (including those using Headless UI or Radix UI patterns)
  - [x] Block shortcut when any overlay is present

- [x] Task 5 - Document shortcut in keyboard shortcuts overlay (AC: 3)
  - [x] Find or create keyboard shortcuts overlay component (referenced from Story 5.4)
  - [x] Add entry: "Send Request: Cmd+Enter (Mac) / Ctrl+Enter (Windows)"
  - [x] Ensure the overlay was introduced in Story 5.4 - verify it exists

- [x] Task 6 - Write tests (AC: all)
  - [x] Write unit tests for `useSendRequestKeyboardShortcut` hook
  - [x] Test that shortcut fires when Cmd+Enter pressed (with no modifiers like Shift)
  - [x] Test that shortcut does NOT fire when isSending is true
  - [x] Test that shortcut does NOT fire when modal is open
  - [x] Test that shortcut DOES fire inside Monaco editor when Cmd+Enter pressed
  - [x] Test that regular Enter inside Monaco editor does NOT send (only inserts newline)

- [x] Task 7 - Verify and commit story changes
  - [x] Run `npx tsc --noEmit` from `` to verify TypeScript compilation
  - [x] Run `npx vitest run` from `` to verify all tests pass
  - [ ] Manual test: Focus URL bar, press Cmd+Enter, verify request sends
  - [ ] Manual test: Focus body editor, press Enter (should insert newline)
  - [ ] Manual test: Focus body editor, press Cmd+Enter (should send)
  - [ ] Manual test: While request is sending, press Cmd+Enter (should do nothing)
  - [ ] Manual test: With save dialog open, press Cmd+Enter (should not send)
  - [x] Commit all code and documentation changes with a message including `Story 6.3`

## Dev Notes

### Critical Implementation Details

**Keyboard Shortcut Hook Pattern:**

Following the established pattern from `useTabKeyboardShortcuts.ts` and `useSidebarKeyboardShortcut.ts`:

```typescript
// useSendRequestKeyboardShortcut.ts
import { useEffect } from 'react';
import { useTabStore } from '@/stores/tabStore';

export default function useSendRequestKeyboardShortcut(onSend: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      
      if (e.key === 'Enter') {
        e.preventDefault();
        
        // Check if request is already in-flight
        const store = useTabStore.getState();
        const activeTab = store.tabs.find(t => t.id === store.activeTabId);
        if (activeTab?.responseState.isSending) {
          return; // Don't send if already sending
        }
        
        // Check for open modals/dropdowns
        const modalOpen = document.querySelector('[role="dialog"], [data-headlessui-state*="open"]');
        if (modalOpen) {
          return;
        }
        
        // All checks passed - trigger send
        onSend();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSend]);
}
```

**Integration in MainPanel:**

The hook needs access to the send request function. Options:
1. Pass `handleSendRequest` as callback (requires useCallback for stable reference)
2. Use the hook internally to call store action directly
3. Expose send function via context or store

**Monaco Editor Special Handling:**

The Monaco editor needs to allow Cmd/Ctrl+Enter to pass through while blocking regular Enter:

```typescript
const isInMonaco = document.activeElement?.closest('.monaco-editor');

// In Monaco: Cmd/Ctrl+Enter sends, Enter inserts newline
// Outside Monaco: Enter sends (but we want only Cmd/Ctrl+Enter)
```

**Modal/Dropdown Detection:**

```typescript
function isAnyOverlayOpen(): boolean {
  // Check for various overlay patterns
  const dialogs = document.querySelectorAll('[role="dialog"]');
  for (const dialog of dialogs) {
    if (dialog.hasAttribute('aria-modal') && window.getComputedStyle(dialog).display !== 'none') {
      return true;
    }
  }
  
  // Check Headless UI patterns
  const openDropdowns = document.querySelectorAll('[data-headlessui-state*="open"]');
  if (openDropdowns.length > 0) return true;
  
  // Check Radix UI patterns  
  const radixOpen = document.querySelectorAll('[data-state="open"][data-portal]');
  if (radixOpen.length > 0) return true;
  
  return false;
}
```

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Zustand with immer middleware (tabStore uses immer)
- Tailwind CSS utility classes with `app-*` custom tokens
- Vitest + React Testing Library for tests
- Monaco Editor for code/body editing
- lucide-react for icons

**Component/File Conventions:**
- Hooks follow `use[Name].ts` pattern in `src/hooks/`
- Tests co-located: `ComponentName.test.tsx` or `useName.test.ts` alongside source
- Keyboard shortcut hooks registered in App.tsx or relevant component
- Use `useActiveResponseState` hook from `src/hooks/useActiveTabState.ts` for reactive response state

**State Management Rules:**
- `isSending` is available via `useActiveResponseState()` or direct tabStore access
- Use `useCallback` for the send function to maintain stable reference for the hook
- Check `isSending` state inside the keyboard handler (not just on mount)

### Integration Points

- **MainPanel send function**: `handleSendRequest` in `src/components/MainPanel/MainPanel.tsx`
- **`isSending` state**: Available via `useActiveResponseState()` which returns `res.isSending`
- **tabStore**: Access active tab's response state via `useTabStore.getState()`
- **Monaco editor**: Check focus via `document.activeElement?.closest('.monaco-editor')`
- **Existing keyboard hooks**: `useTabKeyboardShortcuts.ts`, `useSidebarKeyboardShortcut.ts` for pattern reference
- **SaveRequestDialog**: Uses `saveDialogOpen` state - must be blocked when open

### Keyboard Shortcuts Overlay (Story 5.4)

According to the acceptance criteria, Story 5.4 introduced a keyboard shortcut overlay. If this overlay exists, we need to add the new shortcut to it. If it doesn't exist yet, this story should still implement the shortcut functionality, and the documentation can be added later or as part of this story.

Check for: `src/components/KeyboardShortcutsOverlay.tsx` or similar

### Critical Implementation Guardrails

1. **Never send while already sending**: Always check `isSending` before triggering send. The shortcut should be a no-op when a request is in-flight.

2. **Modal blocking is essential**: Users get frustrated when keyboard shortcuts fire unexpectedly in modals. Always check for open overlays.

3. **Monaco Enter handling**: Regular Enter in Monaco should insert a newline. Only Cmd/Ctrl+Enter should send. This is the inverse of typical form behavior where Enter submits.

4. **Test all focus contexts**: URL bar, headers table, query params table, body editor, auth panel - shortcut should work from all of these.

5. **Cross-platform support**: Both `metaKey` (Mac Cmd) and `ctrlKey` (Windows/Linux Ctrl) must be supported.

### Previous Story Intelligence (Story 6.2)

From **Story 6.2 (Request Cancellation)**:

1. **Request state management**: Story 6.2 added `isSending` to `ResponseSnapshot`. This is the same state we check to prevent double-sending.

2. **AbortController pattern**: Story 6.2 introduced `abortControllerRef` in MainPanel. The keyboard shortcut should NOT interfere with cancellation - if user presses Cancel via UI while shortcut handler runs, both should work correctly.

3. **`handleSendRequest` function**: Already exists in MainPanel at lines ~330-420. The keyboard shortcut should call this same function to ensure consistent behavior.

4. **`useActiveResponseState` hook**: Story 6.2 uses this hook to get `isSending`. We can use the same hook or access via tabStore.

**From Earlier Stories:**

- `useTabKeyboardShortcuts.ts` - Pattern for global keyboard handler registration
- `useSidebarKeyboardShortcut.ts` - Another keyboard shortcut pattern with `.manage()` state access
- Story 5.4 introduced keyboard shortcuts overlay - need to find and update this

### Testing Requirements

**Unit Tests (useSendRequestKeyboardShortcut.test.ts):**

```typescript
// Test: Shortcut fires with Cmd+Enter
const sendFn = vi.fn();
renderHook(() => useSendRequestKeyboardShortcut(sendFn));
fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
expect(sendFn).toHaveBeenCalled();

// Test: Shortcut fires with Ctrl+Enter
fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
expect(sendFn).toHaveBeenCalledTimes(2);

// Test: No firing with Enter only
fireEvent.keyDown(document, { key: 'Enter' });
expect(sendFn).toHaveBeenCalledTimes(2); // Still 2, not 3

// Test: No firing when isSending is true
act(() => {
  useTabStore.setState({
    tabs: [{
      ...useTabStore.getState().tabs[0],
      responseState: { ...defaultResponseSnapshot, isSending: true }
    }]
  });
});
fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
expect(sendFn).toHaveBeenCalledTimes(2); // Still 2, not 3

// Test: No firing when modal is open
// ... mock modal in DOM, verify no call
```

**Integration Tests:**

```typescript
// Test: Full flow from keyboard shortcut to request send
// Render MainPanel, press Cmd+Enter, verify request is sent
```

### Project Structure Notes

**New Files:**
- `src/hooks/useSendRequestKeyboardShortcut.ts` - New hook for send shortcut

**Modified Files:**
- `src/components/MainPanel/MainPanel.tsx` - Add hook integration, useCallback for handleSendRequest
- `src/hooks/useSendRequestKeyboardShortcut.test.ts` - New test file
- Keyboard shortcuts overlay (if exists): Add Cmd+Enter entry

### References

- **Primary Source**: `_bmad-output/planning-artifacts/epic-6.md` (Story 6.3 acceptance criteria)
- **MainPanel**: `src/components/MainPanel/MainPanel.tsx` (handleSendRequest function)
- **tabStore**: `src/stores/tabStore.ts` (isSending state in ResponseSnapshot)
- **Keyboard shortcut hooks**: 
  - `src/hooks/useTabKeyboardShortcuts.ts` (pattern reference)
  - `src/hooks/useSidebarKeyboardShortcut.ts` (pattern reference)
- **Previous Story**: `_bmad-output/implementation-artifacts/6-2-request-cancellation.md` (isSending state, integration)
- **Monaco Editor**: Check via `document.activeElement?.closest('.monaco-editor')`

### Latest Technical Information

**KeyboardEvent modifiers:**
- `e.metaKey` - True when Command (Mac) or Windows key is pressed
- `e.ctrlKey` - True when Control key is pressed
- `e.shiftKey` - Check this to ensure we're not blocking Shift+Enter
- `e.altKey` - Check this to ensure we're not blocking Alt+Enter

**Preventing default:**
- `e.preventDefault()` - Must be called to prevent default browser behavior (which varies by context)
- In Monaco, default Enter inserts newline - we want Cmd+Enter to send but regular Enter to insert newline

**Focus detection:**
- `document.activeElement` - Returns currently focused element
- `.closest('.monaco-editor')` - Check if inside Monaco (returns element or null)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Workflow: create-story (Story 6.3)
- Epic: 6 - Workspace Ergonomics & Developer Flow
- Previous Stories: 6-1-foldable-side-panel, 6-2-request-cancellation
- Auto-generated context engine analysis completed

### Completion Notes List

- Created `useSendRequestKeyboardShortcut.ts` using a `useRef`-based pattern for stable listener registration (registers once, always calls the latest `onSend` via ref). This avoids the need for a heavy `useCallback` dependency array while maintaining correctness.
- Hook guards: checks `isSending` via `useTabStore.getState()`, checks `[role="dialog"]` for open modals (catches SaveRequestDialog with `aria-modal`), checks `[data-headlessui-state*="open"]` for dropdowns.
- Monaco editor case: since the hook only intercepts `Cmd/Ctrl+Enter` (not plain Enter), regular Enter in Monaco naturally inserts a newline without any special case code. `Cmd/Ctrl+Enter` is not bound by Monaco's default configuration, so it bubbles to the window handler correctly.
- `handleSendRequest` in MainPanel wrapped with `useCallback` (deps: url, method, headers, queryParams, body, auth, syncQueryParams, applyEnv, requestTimeoutMs, sslVerify, activeTabId). Hook called immediately after.
- No dedicated keyboard shortcuts overlay from Story 5.4 was found — added a "Keyboard Shortcuts" section to the existing SettingsPanel listing all shortcuts (Send Request, Toggle Sidebar, New Tab, Close Tab, Next Tab).
- 12 new unit tests all pass. Full regression suite: 425/425 tests pass, zero regressions.

### File List

- src/hooks/useSendRequestKeyboardShortcut.ts (new)
- src/hooks/useSendRequestKeyboardShortcut.test.ts (new)
- src/components/MainPanel/MainPanel.tsx (modified — added useCallback import, hook import, wrapped handleSendRequest, registered hook)
- src/components/Settings/SettingsPanel.tsx (modified — added keyboard shortcuts section)
- _bmad-output/implementation-artifacts/6-3-keyboard-shortcut-to-send-request.md (story file)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status updated)

## Change Log

- 2026-03-11: Story 6.3 context created via automated create-story workflow — comprehensive developer guide with keyboard shortcut hook, Monaco editor handling, modal blocking, and testing requirements
- 2026-03-11: Story 6.3 implemented by dev agent (claude-sonnet-4-6) — created useSendRequestKeyboardShortcut hook, integrated into MainPanel, added keyboard shortcuts section to SettingsPanel, 12 new tests, 425/425 passing

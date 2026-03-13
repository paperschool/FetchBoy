# Story 8.1: MainPanel Component Refactoring (CRITICAL)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer maintaining FetchBoy,
I want MainPanel.tsx to comply with code styling standards (≤150 lines),
so that the codebase remains maintainable and follows project conventions.

## Acceptance Criteria

1. MainPanel.tsx reduced from 1015 lines to ≤150 lines
2. URL parsing/extraction functions moved to `MainPanel.utils.ts`
3. Progress state management moved to `useRequestProgress` hook (already exists, integrate better)
4. Broken into sub-components: RequestBuilder, RequestControls, RequestDetails
5. All existing functionality preserved and tested
6. No regressions in request building/sending flow
7. Run `npx tsc --noEmit` and `cargo check` with no errors

## Tasks / Subtasks

- [ ] Task 1 - Extract URL utility functions to MainPanel.utils.ts (AC: 1, 2)
  - [ ] Extract `extractErrorReason()` function
  - [ ] Extract `buildRequestedUrlForDisplay()` function
  - [ ] Extract `parseUrlWithFallback()` function
  - [ ] Extract `stripQueryFromUrl()` function
  - [ ] Extract `buildUrlFromQueryParams()` function
  - [ ] Extract `areQueryParamsEqual()` function
  - [ ] Create barrel export in MainPanel/index.ts

- [ ] Task 2 - Integrate existing useRequestProgress hook (AC: 3)
  - [ ] Remove inline progress management code from MainPanel
  - [ ] Use existing `useRequestProgress` hook from `@/hooks/useRequestProgress`
  - [ ] Connect to request flow via existing store pattern

- [ ] Task 3 - Create RequestControls sub-component (AC: 4)
  - [ ] Create `src/components/MainPanel/components/RequestControls.tsx`
  - [ ] Move Send/Cancel buttons and Save button to this component
  - [ ] Accept props: isSending, onSend, onCancel, onSave

- [ ] Task 4 - Create RequestDetails sub-component (AC: 4)
  - [ ] Create `src/components/MainPanel/components/RequestDetails.tsx`
  - [ ] Move tabbed request details (headers, query, body, auth, options) to this component
  - [ ] Accept props for all the state and setters

- [ ] Task 5 - Refactor MainPanel.tsx to compose children (AC: 1, 4)
  - [ ] Import and render RequestControls and RequestDetails
  - [ ] Keep HTTP method selector and URL input in MainPanel (top-level request builder)
  - [ ] Ensure total lines ≤150

- [ ] Task 6 - Final Task - Commit story changes
  - [ ] Run `npx tsc --noEmit` from `` to verify TypeScript compilation
  - [ ] Run `cargo check` from `src-tauri/` to verify Rust compilation
  - [ ] Run `npx vitest run` from `` to verify all tests pass
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 8.1

## Dev Notes

### Current MainPanel.tsx Analysis

**File:** `src/components/MainPanel/MainPanel.tsx`
**Current Lines:** 1015
**Target:** ≤150 lines

**Embedded Functions to Extract (lines ~76-162):**

```typescript
// Current URL utility functions in MainPanel.tsx:
function extractErrorReason(error: unknown): string { ... }
function buildRequestedUrlForDisplay(baseUrl: string, queryParams: Array<...>, auth: AuthState): string { ... }
function parseUrlWithFallback(rawUrl: string): URL | null { ... }
function stripQueryFromUrl(rawUrl: string): string { ... }
function buildUrlFromQueryParams(rawUrl: string, params: Array<...>): string | null { ... }
function areQueryParamsEqual(left: Array<...>, right: Array<...>): boolean { ... }
```

**Embedded Progress Management (lines ~447-486):**

```typescript
// Current inline progress code:
const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
const startProgress = () => { ... };
const stopProgress = () => { ... };
// Plus useEffect for progress lifecycle
```

**Existing Hook to Use:**
- `useRequestProgress` from `@/hooks/useRequestProgress` - already exists!

### Proposed File Structure After Refactoring

```
src/components/MainPanel/
├── MainPanel.tsx              # Main component (~120 lines) - composes children
├── MainPanel.types.ts         # Type definitions
├── MainPanel.utils.ts         # URL utility functions (extracted)
├── MainPanel.hooks.ts         # Custom hooks (if additional needed)
├── index.ts                   # Barrel export
└── components/
    ├── CopyAsButton.tsx       # Existing - keep as is
    ├── HighlightedUrlInput.tsx # Existing - keep as is
    ├── RequestControls.tsx    # NEW - Send/Cancel/Save buttons
    └── RequestDetails.tsx    # NEW - Tabbed request details
```

### Critical Implementation Details

**1. URL Utilities to Extract:**

Create `MainPanel.utils.ts`:

```typescript
// MainPanel.utils.ts
import type { AuthState } from "@/stores/requestStore";

export function extractErrorReason(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const maybeMessage =
      "message" in error && typeof error.message === "string"
        ? error.message
        : "error" in error && typeof error.error === "string"
          ? error.error
          : null;
    if (maybeMessage && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
  return "Unknown error";
}

export function buildRequestedUrlForDisplay(
  baseUrl: string,
  queryParams: Array<{ key: string; value: string; enabled: boolean }>,
  auth: AuthState,
): string {
  try {
    const parsedUrl = new URL(baseUrl);
    for (const param of queryParams) {
      if (param.enabled && param.key.trim().length > 0) {
        parsedUrl.searchParams.append(param.key, param.value);
      }
    }
    if (
      auth.type === "api-key" &&
      auth.in === "query" &&
      auth.key.trim().length > 0
    ) {
      parsedUrl.searchParams.append(auth.key, auth.value);
    }
    return parsedUrl.toString();
  } catch {
    return baseUrl;
  }
}

export function parseUrlWithFallback(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) return null;
  try {
    return new URL(trimmed);
  } catch {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return null;
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

export function stripQueryFromUrl(rawUrl: string): string {
  const parsedUrl = parseUrlWithFallback(rawUrl);
  if (!parsedUrl) {
    const hashIndex = rawUrl.indexOf("#");
    const beforeHash = hashIndex >= 0 ? rawUrl.slice(0, hashIndex) : rawUrl;
    const hash = hashIndex >= 0 ? rawUrl.slice(hashIndex) : "";
    const queryIndex = beforeHash.indexOf("?");
    const withoutQuery = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
    return `${withoutQuery}${hash}`;
  }
  parsedUrl.search = "";
  return parsedUrl.toString();
}

export function buildUrlFromQueryParams(
  rawUrl: string,
  params: Array<{ key: string; value: string; enabled: boolean }>,
): string | null {
  const parsedUrl = parseUrlWithFallback(rawUrl);
  if (!parsedUrl) return null;
  parsedUrl.search = "";
  for (const param of params) {
    if (param.enabled && param.key.trim().length > 0) {
      parsedUrl.searchParams.append(param.key, param.value);
    }
  }
  return parsedUrl.toString();
}

export function areQueryParamsEqual(
  left: Array<{ key: string; value: string; enabled: boolean }>,
  right: Array<{ key: string; value: string; enabled: boolean }>,
): boolean {
  if (left.length !== right.length) return false;
  return left.every((row, index) => {
    const other = right[index];
    return (
      row.key === other.key &&
      row.value === other.value &&
      row.enabled === other.enabled
    );
  });
}
```

**2. Use Existing useRequestProgress Hook:**

The hook already exists at `@/hooks/useRequestProgress`. MainPanel should connect to it rather than managing progress inline:

```typescript
// In MainPanel.tsx - simplified progress integration
import { useRequestProgressStore } from "@/hooks/useRequestProgress";

// Instead of inline progressRef, startProgress, stopProgress...
const { isRequestInFlight, requestProgress } = useRequestProgressStore();

// The hook already handles:
// - startRequest()
// - updateProgress(n)
// - completeRequest()
// - cancelRequest()
// - reset()

// Connect to request flow - the hook integrates with request sending
// Verify existing integration or add proper connections
```

**3. RequestControls Component:**

```typescript
// components/RequestControls.tsx
import { Loader2, Save, Send } from "lucide-react";
import { CopyAsButton } from "../CopyAsButton";
import type { ResolvedRequest } from "@/lib/generateSnippet";

interface RequestControlsProps {
  isSending: boolean;
  onSend: () => void;
  onCancel: () => void;
  onSave: () => void;
  resolvedRequest: ResolvedRequest;
}

export function RequestControls({
  isSending,
  onSend,
  onCancel,
  onSave,
  resolvedRequest,
}: RequestControlsProps) {
  return (
    <div className="flex items-center gap-2" data-tour="request-controls">
      {isSending ? (
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 h-9 rounded-md border border-amber-500 bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600 hover:border-amber-600 cursor-pointer transition-colors"
          aria-label="Cancel request"
        >
          <Loader2 size={14} className="animate-spin" />
          Cancel
        </button>
      ) : (
        <button
          type="button"
          onClick={onSend}
          className="flex items-center gap-1.5 h-9 rounded-md border border-green-600 bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 hover:border-green-700 cursor-pointer transition-colors"
        >
          <Send size={14} />
          Send
        </button>
      )}
      <span className="w-px self-stretch bg-app-subtle opacity-50" aria-hidden="true" />
      <button
        type="button"
        onClick={onSave}
        className="border-app-subtle text-app-secondary h-9 rounded-md border px-3 flex items-center cursor-pointer"
        title="Save"
      >
        <Save size={15} />
      </button>
      <CopyAsButton resolvedRequest={resolvedRequest} />
    </div>
  );
}
```

**4. RequestDetails Component:**

This will be larger - wraps the tabbed interface. Accept props for all state and setters.

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Tailwind CSS v4 with dark mode
- Zustand for state management
- Vitest + React Testing Library for tests

**Component Pattern:**
- Follow existing component patterns in `src/components/`
- Use barrel exports in `index.ts`
- Keep types in separate `.types.ts` file
- Keep utilities in separate `.utils.ts` file

**File Naming:**
- Use PascalCase for component files: `MainPanel.tsx`, `RequestControls.tsx`
- Use kebab-case for utilities: `MainPanel.utils.ts`

### Integration Points

**New Files:**
- `src/components/MainPanel/MainPanel.types.ts` - Type definitions
- `src/components/MainPanel/MainPanel.utils.ts` - URL utilities
- `src/components/MainPanel/components/RequestControls.tsx` - Controls sub-component
- `src/components/MainPanel/components/RequestDetails.tsx` - Details sub-component

**Modified Files:**
- `src/components/MainPanel/MainPanel.tsx` - Refactored to ≤150 lines
- `src/components/MainPanel/index.ts` - Update barrel exports

**Remove Inline Code:**
- Delete `extractErrorReason`, `buildRequestedUrlForDisplay`, `parseUrlWithFallback`, `stripQueryFromUrl`, `buildUrlFromQueryParams`, `areQueryParamsEqual` functions from MainPanel.tsx
- Remove `progressRef`, `startProgress`, `stopProgress` and related useEffect from MainPanel.tsx

### Critical Implementation Guardrails

1. **Preserve ALL functionality**: Every feature must work exactly as before
2. **No breaking changes**: External components importing MainPanel should not need changes
3. **Progress tracking**: Ensure the progress bar still works - integrate properly with existing hook
4. **URL sync**: The "Sync Query Parameters" feature must continue working
5. **Environment variables**: Variable interpolation must continue working
6. **History**: Request history must still be persisted
7. **Keyboard shortcuts**: The send request shortcut must still work

### Testing Requirements

**Unit Tests:**

1. Test that MainPanel.utils.ts functions produce correct output
2. Test RequestControls renders correctly for both sending and idle states
3. Test RequestDetails renders all tabs

**Integration Tests:**

1. Test full request flow: build request → send → see response
2. Test cancel request flow
3. Test save request flow
4. Test query parameter sync feature

### Project Structure Notes

**After Refactoring - MainPanel.tsx should look approximately:**

```typescript
// MainPanel.tsx - Target ~120 lines
import { useState } from "react";
import { ProgressBar } from "@/components/ProgressBar/ProgressBar";
import { useRequestProgressStore } from "@/hooks/useRequestProgress";
import { useActiveRequestState, useActiveResponseState } from "@/hooks/useActiveTabState";
import { useEnvironment } from "@/hooks/useEnvironment";
import { KeyValueRows } from "@/components/RequestBuilder/KeyValueRows";
import { ResponseViewer } from "@/components/ResponseViewer/ResponseViewer";
import { AuthPanel } from "@/components/AuthPanel/AuthPanel";
import { TimeoutInput } from "@/components/RequestBuilder/TimeoutInput";
import { HighlightedUrlInput } from "./HighlightedUrlInput";
import { RequestControls } from "./components/RequestControls";
import { RequestDetails } from "./components/RequestDetails";
import { useSendRequestKeyboardShortcut } from "@/hooks/useSendRequestKeyboardShortcut";
import type { HttpMethod, RequestTab } from "@/stores/requestStore";
import { extractQueryParamsFromUrl, buildUrlFromQueryParams, areQueryParamsEqual } from "./MainPanel.utils";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const REQUEST_TABS: Array<{ id: RequestTab; label: string }> = [
  { id: "headers", label: "Headers" },
  { id: "query", label: "Query Params" },
  { id: "body", label: "Body" },
  { id: "auth", label: "Auth" },
  { id: "options", label: "Options" },
];

export function MainPanel() {
  // State and hooks (~30 lines)
  // Request handlers (~20 lines)
  // Render (~70 lines)
  // Total: ~120 lines
}
```

### References

- **Code Styling Standards**: `_bmad/_memory/tech-writer-sidecar/code-styling-standards.md` (Component Size Limits section)
- **Component Refactoring Pattern**: Same file (Component Design Principles > Breaking Down Large Components)
- **Existing useRequestProgress Hook**: `src/hooks/useRequestProgress.ts`
- **ProgressBar Component**: `src/components/ProgressBar/ProgressBar.tsx`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

- Workflow: create-story (Story 8.1)
- Epic: 8 - Code Quality & Styling Compliance
- Source: `_bmad-output/code-styling-audit-report.md`
- Standard Reference: `_bmad/_memory/tech-writer-sidecar/code-styling-standards.md`
- Current MainPanel.tsx: 1015 lines
- Target: ≤150 lines

### Completion Notes List

### File List

- src/components/MainPanel/MainPanel.types.ts (new)
- src/components/MainPanel/MainPanel.utils.ts (new)
- src/components/MainPanel/components/RequestControls.tsx (new)
- src/components/MainPanel/components/RequestDetails.tsx (new)
- src/components/MainPanel/MainPanel.tsx (modified - refactored)
- src/components/MainPanel/index.ts (modified - updated exports)

## Change Log

- 2026-03-12: Story 8.1 created — MainPanel Component Refactoring (critical, 1015 lines → ≤150)

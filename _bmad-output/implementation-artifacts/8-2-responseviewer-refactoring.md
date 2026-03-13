# Story 8.2: ResponseViewer Component Refactoring

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer maintaining FetchBoy,
I want ResponseViewer.tsx to comply with code styling standards (≤150 lines),
so that the codebase remains maintainable and follows project conventions.

## Acceptance Criteria

1. ResponseViewer.tsx reduced from 413 lines to ≤150 lines
2. Response parsing/type utility functions moved to separate files
3. Broken into sub-components: ResponseHeaders, ResponseBody, ResponseMetadata
4. ImageViewer extracted to its own component file
5. All existing functionality preserved and tested
6. No regressions in response display flow
7. Run `npx tsc --noEmit` and `cargo check` with no errors

## Tasks / Subtasks

- [ ] Task 1 - Extract type definitions to ResponseViewer.types.ts (AC: 1, 2)
  - [ ] Move `ResponseHeaderRow` interface to types file
  - [ ] Move `ResponseData` interface to types file
  - [ ] Move helper functions (`isImageContentType`, `isPdfContentType`, `isBinaryContentType`) to types/utils

- [ ] Task 2 - Extract ImageViewer to own component file (AC: 4)
  - [ ] Create `src/components/ResponseViewer/components/ImageViewer.tsx`
  - [ ] Move ImageViewer component with all its state/handlers
  - [ ] Create barrel export in ResponseViewer/index.ts

- [ ] Task 3 - Create ResponseHeaders sub-component (AC: 3)
  - [ ] Create `src/components/ResponseViewer/components/ResponseHeaders.tsx`
  - [ ] Move headers rendering logic to this component

- [ ] Task 4 - Create ResponseBody sub-component (AC: 3)
  - [ ] Create `src/components/ResponseViewer/components/ResponseBody.tsx`
  - [ ] Move body rendering logic (Monaco editor, image viewer, PDF, binary)
  - [ ] Accept response and language state as props

- [ ] Task 5 - Create ResponseMetadata sub-component (AC: 3)
  - [ ] Create `src/components/ResponseViewer/components/ResponseMetadata.tsx`
  - [ ] Move status, time, size, URL display to this component

- [ ] Task 6 - Refactor ResponseViewer.tsx to compose children (AC: 1, 3)
  - [ ] Import and render ResponseMetadata, ResponseHeaders, ResponseBody
  - [ ] Keep tab state and error/cancelled handling in main component
  - [ ] Ensure total lines ≤150

- [ ] Task 7 - Final Task - Commit story changes
  - [ ] Run `npx tsc --noEmit` from `` to verify TypeScript compilation
  - [ ] Run `cargo check` from `src-tauri/` to verify Rust compilation
  - [ ] Run `npx vitest run` from `` to verify all tests pass
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 8.2

## Dev Notes

### Current ResponseViewer.tsx Analysis

**File:** `src/components/ResponseViewer/ResponseViewer.tsx`
**Current Lines:** 413
**Target:** ≤150 lines

**Components/Functions to Extract:**

1. **ImageViewer** (lines ~64-161): Contains zoom, pan, drag state and handlers
   - `zoom`, `position`, `isDragging`, `dragStart` state
   - `handleZoomIn`, `handleZoomOut`, `handleReset`
   - `handleMouseDown`, `handleMouseMove`, `handleMouseUp`, `handleWheel`

2. **Helper Functions** (lines ~26-39):
   - `isImageContentType(contentType?: string): boolean`
   - `isPdfContentType(contentType?: string): boolean`
   - `isBinaryContentType(contentType?: string): boolean`

3. **Type Definitions** (lines ~9-23):
   - `ResponseHeaderRow` interface
   - `ResponseData` interface
   - `ResponseViewerProps` interface
   - `ResponseTab` type

4. **getStatusColorClass** (lines ~41-52): Status color helper

### Proposed File Structure After Refactoring

```
src/components/ResponseViewer/
├── ResponseViewer.tsx              # Main component (~130 lines) - composes children
├── ResponseViewer.types.ts         # Type definitions
├── ResponseViewer.utils.ts         # Helper functions
├── index.ts                        # Barrel export
└── components/
    ├── ImageViewer.tsx            # NEW - Extracted image preview with zoom/pan
    ├── ResponseHeaders.tsx        # NEW - Headers tab content
    ├── ResponseBody.tsx           # NEW - Body tab content (Monaco + image + PDF)
    └── ResponseMetadata.tsx       # NEW - Status, time, size display
```

### Critical Implementation Details

**1. Types to Extract - ResponseViewer.types.ts:**

```typescript
// ResponseViewer.types.ts
export interface ResponseHeaderRow {
  key: string;
  value: string;
}

export interface ResponseData {
  status: number;
  statusText: string;
  responseTimeMs: number;
  responseSizeBytes: number;
  body: string;
  headers: ResponseHeaderRow[];
  contentType?: string;
}

export interface ResponseViewerProps {
  response: ResponseData | null;
  error: string | null;
  logs?: string[];
  onClearLogs?: () => void;
  requestedUrl?: string;
  wasCancelled?: boolean;
  wasTimedOut?: boolean;
  timedOutAfterSec?: number | null;
}

export type ResponseTab = 'body' | 'headers' | 'logs';
```

**2. Helper Functions - ResponseViewer.utils.ts:**

```typescript
// ResponseViewer.utils.ts
export function getStatusColorClass(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600';
  if (status >= 400 && status < 500) return 'text-yellow-600';
  if (status >= 500) return 'text-red-600';
  return 'text-app-primary';
}

export function isImageContentType(contentType?: string): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().startsWith('image/');
}

export function isPdfContentType(contentType?: string): boolean {
  return contentType?.toLowerCase() === 'application/pdf';
}

export function isBinaryContentType(contentType?: string): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return ct.startsWith('image/') || ct === 'application/octet-stream' || ct === 'application/pdf';
}
```

**3. ImageViewer Component:**

```typescript
// components/ImageViewer.tsx
import { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageViewerProps {
  contentType?: string;
  body: string;
}

export function ImageViewer({ contentType, body }: ImageViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // ... (all existing zoom/pan logic)
  
  return (
    // ... (existing JSX)
  );
}
```

### Architecture Compliance

**Tech Stack:**
- React 18+ with TypeScript
- Tailwind CSS v4 with dark mode
- Monaco Editor for code display
- Vitest + React Testing Library for tests

**Component Pattern:**
- Follow existing component patterns in `src/components/`
- Use barrel exports in `index.ts`
- Keep types in separate `.types.ts` file
- Keep utilities in separate `.utils.ts` file

### Integration Points

**New Files:**
- `src/components/ResponseViewer/ResponseViewer.types.ts` - Type definitions
- `src/components/ResponseViewer/ResponseViewer.utils.ts` - Helper functions
- `src/components/ResponseViewer/components/ImageViewer.tsx` - Image preview component
- `src/components/ResponseViewer/components/ResponseHeaders.tsx` - Headers display
- `src/components/ResponseViewer/components/ResponseBody.tsx` - Body content
- `src/components/ResponseViewer/components/ResponseMetadata.tsx` - Status metadata

**Modified Files:**
- `src/components/ResponseViewer/ResponseViewer.tsx` - Refactored to ≤150 lines
- `src/components/ResponseViewer/index.ts` - Update barrel exports

### Critical Implementation Guardrails

1. **Preserve ALL functionality**: Image zoom/pan, PDF download, binary download, all tabs
2. **No breaking changes**: External components importing ResponseViewer should not need changes
3. **State management**: ImageViewer must maintain its own zoom/pan state
4. **Type exports**: Ensure types are exported for other components that use them
5. **Monaco Editor**: Preserve language selection dropdown and read-only mode

### Testing Requirements

**Unit Tests:**

1. Test ResponseViewer.utils.ts functions produce correct output
2. Test ImageViewer renders and responds to zoom/pan
3. Test ResponseHeaders renders header rows correctly
4. Test ResponseBody handles all content types

**Integration Tests:**

1. Test full response display flow with JSON body
2. Test image preview with zoom controls
3. Test PDF/binary download functionality
4. Test tab switching between body/headers/logs

### References

- **Code Styling Standards**: `_bmad/_memory/tech-writer-sidecar/code-styling-standards.md` (Component Size Limits section)
- **Component Refactoring Pattern**: Same file (Component Design Principles > Breaking Down Large Components)
- **Previous Story**: 8-1-mainpanel-refactoring.md (for patterns)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-20250514

### Debug Log References

- Workflow: create-story (Story 8.2)
- Epic: 8 - Code Quality & Styling Compliance
- Source: `_bmad-output/code-styling-audit-report.md`
- Current ResponseViewer.tsx: 413 lines
- Target: ≤150 lines

### Completion Notes List

### File List

- src/components/ResponseViewer/ResponseViewer.types.ts (new)
- src/components/ResponseViewer/ResponseViewer.utils.ts (new)
- src/components/ResponseViewer/components/ImageViewer.tsx (new)
- src/components/ResponseViewer/components/ResponseHeaders.tsx (new)
- src/components/ResponseViewer/components/ResponseBody.tsx (new)
- src/components/ResponseViewer/components/ResponseMetadata.tsx (new)
- src/components/ResponseViewer/ResponseViewer.tsx (modified - refactored)
- src/components/ResponseViewer/index.ts (modified - updated exports)

## Change Log

- 2026-03-12: Story 8.2 created — ResponseViewer Component Refactoring (413 lines → ≤150)

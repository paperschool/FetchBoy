# Epic 8: Code Quality & Styling Compliance

**Goal:** Refactor oversized components to comply with code styling standards (150-line limit), extract logic to custom hooks and utilities, and ensure consistent component architecture across the codebase.

**Phase Alignment:** Phase 8 — Code Quality

---

## Stories

Final Step for every story: commit all code and documentation changes for that story before marking it complete.

### Story 8.1: MainPanel Component Refactoring (CRITICAL)

**Goal:** Refactor MainPanel.tsx from 1015 lines to under 150 lines by extracting URL handling utilities, progress management, and breaking into focused sub-components.

**Acceptance Criteria:**
- MainPanel.tsx reduced to ≤150 lines
- URL parsing/extraction functions moved to MainPanel.utils.ts
- Progress state management moved to useRequestProgress hook
- Broken into sub-components: RequestBuilder, RequestControls, RequestDetails
- All existing functionality preserved and tested
- No regressions in request building/sending flow

---

### Story 8.2: ResponseViewer Component Refactoring

**Goal:** Refactor ResponseViewer.tsx from 413 lines to under 150 lines by extracting response parsing logic and breaking into focused sub-components.

**Acceptance Criteria:**
- ResponseViewer.tsx reduced to ≤150 lines
- Response parsing/extraction functions moved to ResponseViewer.utils.ts or shared lib
- Broken into sub-components: ResponseHeaders, ResponseBody, ResponseMetadata
- All existing functionality preserved and tested

---

### Story 8.3: SettingsPanel & AuthPanel Refactoring

**Goal:** Refactor SettingsPanel.tsx (187 lines) and AuthPanel.tsx (135 lines) to meet component size standards and improve separation of concerns.

**Acceptance Criteria:**
- SettingsPanel.tsx reduced to ≤150 lines
- AuthPanel.tsx reduced to ≤150 lines (or stays under)
- Settings broken into category-specific sub-components
- Auth types extracted to separate components
- All existing functionality preserved

---

### Story 8.4: EnvironmentPanel Component Refactoring

**Goal:** Refactor EnvironmentPanel.tsx from 325 lines to under 150 lines by extracting environment variable logic, validation, and breaking into focused sub-components.

**Acceptance Criteria:**
- EnvironmentPanel.tsx reduced to ≤150 lines
- Environment variable parsing/validation moved to EnvironmentPanel.utils.ts
- Broken into sub-components: EnvironmentList, EnvironmentEditor, EnvironmentSelector
- All existing functionality preserved and tested
- No regressions in environment management flow

---

### Story 8.5: HistoryPanel Component Refactoring

**Goal:** Refactor HistoryPanel.tsx from 187 lines to under 150 lines by extracting history filtering logic and breaking into focused sub-components.

**Acceptance Criteria:**
- HistoryPanel.tsx reduced to ≤150 lines
- History filtering/search functions moved to HistoryPanel.utils.ts
- Broken into sub-components: HistoryList, HistoryFilters, HistoryItem
- All existing functionality preserved and tested
- No regressions in request history display

---

### Story 8.6: CollectionTree Component Refactoring

**Goal:** Refactor CollectionTree.tsx from 195 lines to under 150 lines by extracting tree manipulation logic and breaking into focused sub-components.

**Acceptance Criteria:**
- CollectionTree.tsx reduced to ≤150 lines
- Tree manipulation/movement functions moved to CollectionTree.utils.ts
- Broken into sub-components: TreeFolder, TreeRequest, TreeDragHandler
- All existing functionality preserved and tested
- No regressions in collection browsing/organization

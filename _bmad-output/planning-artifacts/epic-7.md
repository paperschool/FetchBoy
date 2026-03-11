# Epic 7: First-Run Experience & Polish

**Goal:** Add a polished first-run experience with a nice startup animation and an interactive onboarding tutorial to help new users get started with the app.

**Phase Alignment:** Phase 7 — Post-MVP Enhancement

---

## Stories

Final Step for every story: commit all code and documentation changes for that story before marking it complete.

---

### Story 7.1: Nice Startup Animation

As a user,
I want to see a branded animation when launching the app,
So that the app feels polished and professional during startup.

**Acceptance Criteria:**

- A startup splash screen/loading animation displays immediately when the app launches
- The animation shows the FetchBoy logo/app icon with a subtle motion effect (fade-in, scale, or similar)
- The animation plays for at least 1.5 seconds (to feel intentional) but no more than 3 seconds
- After the animation completes, the main app UI fades in smoothly
- The animation respects the current theme (light/dark) - appropriate colors for each
- Startup time is not noticeably impacted - the animation runs concurrently with app initialization
- The animation can be skipped by clicking/tapping if it takes too long

---

### Story 7.2: Onboarding Tooltip Tutorial

As a new user,
I want to see an interactive tooltip tour that highlights key features,
So that I can quickly understand how to use the app without reading documentation.

**Acceptance Criteria:**

- A tooltip-based tour appears on first app launch after the startup animation
- The tour highlights 4-5 key UI areas in sequence:
  1. Collections sidebar - "Organize your API requests here"
  2. Request builder - "Build your HTTP request"
  3. Send button - "Click to send your request"
  4. Response panel - "View your API response here"
  5. Settings/Environment - "Configure environments and auth"
- Each tooltip has a "Next" button to proceed to the next step, and "Skip" to exit the tour
- The current tooltip points to its target UI element with an arrow or highlight
- The tour state is persisted - if a user exits mid-way, it remembers where they were (or can restart)
- A "Restart Tutorial" option is available in Settings for users who want to see it again
- The tooltip library used is compatible with React and doesn't conflict with existing UI
- Tour can be dismissed with Escape key or by clicking outside

---

### Story 7.3: Sample "Getting Started" Collection

As a new user,
I want to see pre-loaded example requests on first launch,
So that I can immediately try the app without configuring anything myself.

**Acceptance Criteria:**

- A "Getting Started" collection is seeded on first launch containing 3–4 example requests (GET/POST to JSONPlaceholder)
- A `hasSeededSampleData` flag in settings prevents re-seeding on subsequent launches
- Collection is fully editable and deletable like any user-created collection

---

### Story 7.4: Empty State Polish

As a user,
I want to see welcoming empty states instead of blank space,
So that the app feels intentional and guides me toward the next action.

**Acceptance Criteria:**

- Collections sidebar displays a distinct empty state with label and icon when no collections exist (e.g. "No collections yet — create one to get started")
- Request history displays a distinct empty state with label and icon when no history exists (e.g. "Your sent requests will appear here")
- Response panel displays a distinct empty state with label and icon before the first request is sent (e.g. "Hit Send to see your response")
- All empty state components are theme-aware (light/dark)

---

### Story 7.5: Keyboard Shortcut Overlay

As a user,
I want to press `?` to see all keyboard shortcuts,
So that I can discover and learn the app's power features without reading docs.

**Acceptance Criteria:**

- Pressing `?` when not focused in an input opens a modal listing all keyboard shortcuts grouped by category
- Modal closes on `Escape` or click-outside
- Shortcuts are sourced from a single constants file (no duplication)

---

### Story 7.6: What's New Modal on Update

As a returning user,
I want to see what changed after an update,
So that I notice new features without reading release notes.

**Acceptance Criteria:**

- On launch, the app compares the stored version against the current `package.json` version
- If the version has changed, a modal displays a bullet-point changelog for that version
- Modal is dismissed with one click and is never reshown for the same version
- Changelog entries are stored in a local JSON file

---

### Story 7.7: Image & Binary Response Handling

As a user,
I want to see images and binary data rendered properly in the response viewer,
So that I can verify image endpoints and download files directly from the app.

**Technical Context:**

- Currently, the backend reads all responses as text using `.text()`, which corrupts binary data
- The frontend receives garbled text for image responses in the Monaco editor

**Acceptance Criteria:**

- Backend detects binary content types (image/png, image/jpeg, image/gif, image/webp, image/svg+xml, application/octet-stream, application/pdf)
- Backend reads binary responses using `.bytes()` and encodes as base64
- Backend adds `contentType` field to response data indicating the media type
- ResponseViewer checks `contentType` and renders appropriately:
  - For image/\* types: displays an `<img>` tag with base64 data URI
  - For application/pdf: displays an embedded PDF viewer or download link
  - For other binary types: shows a download button with file info
- If the response cannot be decoded as valid base64/UTF-8, fall back to showing raw data with appropriate warning
- The raw/plaintext option remains available in the language dropdown as a fallback

**Backend Changes Required:**

- In `src-tauri/src/http.rs`:
  - Check `Content-Type` header before reading response
  - If binary type detected, use `response.bytes()` and encode to base64
  - Add `contentType: String` field to `ResponseData`

**Frontend Changes Required:**

- In `ResponseViewer.tsx`:
  - Import `ResponseData` type (add `contentType` field)
  - Add logic to detect image/binary content types
  - Render image preview for image/\* responses
  - Show download link for other binary types
  - Fall back to Monaco editor for text-based responses

---

### Story 7.8: Request In-Flight Progress Bar

As a user,
I want to see a slim top-of-window progress bar during a request,
So that I know the app is working even when looking away from the loading spinner.

**Acceptance Criteria:**

- A fixed-position bar at the top of the main content area animates from 0% → 80% while the request is in flight, then rapidly completes to 100% on response
- The bar respects the cancel action (completes/hides on cancellation)
- Implemented in pure CSS/React with no new library dependency

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

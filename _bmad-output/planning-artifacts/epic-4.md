# Epic 4: Polish & Packaging

**Goal:** Bring the app to a shippable state — light/dark theming, JSON import/export for collections and environments, a complete settings panel, and cross-platform installer builds under 15MB.

**Phase Alignment:** Phase 4 — Week 6

---

## Stories

Final Step for every story: commit all code and documentation changes for that story before marking it complete.

### Story 4.1: Light/Dark Theme

**Goal:** Implement light, dark, and system-follow theme modes using Tailwind CSS dark mode classes, toggled from the settings panel.

**Acceptance Criteria:**
- Theme setting persists across restarts (stored in SQLite settings table)
- System mode follows OS-level preference via `prefers-color-scheme`
- Switching theme applies instantly without page reload
- All components — sidebar, editor, response panel, modals — are correctly styled in both modes
- Monaco Editor uses matching light/dark theme variant

---

### Story 4.2: Import/Export Collections and Environments

**Goal:** Allow users to export collections and environments as JSON files and import them back, enabling portability between machines.

**Acceptance Criteria:**
- Export collection: writes a JSON file via Tauri file-save dialog
- Export environment: writes a JSON file via Tauri file-save dialog
- Import collection: reads JSON via Tauri file-open dialog, validates, inserts into DB
- Import environment: reads JSON via Tauri file-open dialog, validates, inserts into DB
- Import shows a summary of what was imported (e.g. "Imported 3 requests into My API")
- Invalid or corrupt JSON shows a user-readable error, no partial writes

---

### Story 4.3: Settings Panel

**Goal:** Build a settings modal accessible from the top-right gear icon exposing the four configurable options.

**Acceptance Criteria:**
- Settings accessible via gear icon (⚙) in top bar
- Theme selector: Light / Dark / System (uses Story 4.1)
- Default request timeout: numeric input in milliseconds (min 100, max 300,000)
- SSL certificate verification: toggle (on by default)
- Editor font size: integer stepper (range 10–24, default 14)
- All settings persist to SQLite on change
- Settings are read by `requestStore` / `send_request` command at use time

---

### Story 4.4: App Packaging and Installers

**Goal:** Configure Tauri bundler to produce signed, release-optimised installers for Windows (.msi), macOS (.dmg), and Linux (.AppImage / .deb) with an app icon, all under the 15MB target.

**Acceptance Criteria:**
- `tauri build` produces installers for all three platforms in CI
- macOS .dmg installer and bundle are produced
- Windows .msi installer is produced
- Linux .AppImage and .deb are produced
- App icon (1024×1024 PNG source) is converted to all required platform formats
- Bundle size is verified ≤ 15MB per installer in CI build output
- App name, version, and identifier match `tauri.conf.json`

---

### Story 4.5: Windows Build Compatibility

**Goal:** Ensure the GitHub Actions Windows CI job produces a valid NSIS installer by fixing the emoji in `productName` and pinning NSIS as the Windows bundle target.

**Acceptance Criteria:**
- `productName` in `tauri.conf.json` is ASCII-only (emoji removed); window title in-app retains the emoji
- Windows CI job completes and uploads a `.exe` NSIS installer artifact
- NSIS installer is ≤ 15 MB (existing size-check step passes)
- macOS and Linux CI jobs are unaffected
- `bundle.windows.nsis` config is present in `tauri.conf.json`

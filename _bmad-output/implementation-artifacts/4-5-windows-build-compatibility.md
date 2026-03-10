# Story 4.5: Windows Build Compatibility

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Dispatch maintainer,
I want the GitHub Actions Windows CI job to build and produce a valid NSIS installer without errors,
so that Windows users can download and install the app from every release.

## Acceptance Criteria

1. **productName is Windows-safe**: `tauri.conf.json` `productName` contains no emoji or non-ASCII characters. The app window title may still display the emoji, but the bundle name used for installer paths must be plain ASCII.
2. **NSIS installer produced**: the `windows-latest` CI job completes successfully and uploads a `.exe` (NSIS) installer artifact.
3. **Bundle size passes**: the NSIS `.exe` is ≤ 15 MB (existing size-check step in `build.yml` must pass).
4. **No regressions on macOS/Linux**: the macOS and Linux CI jobs continue to pass without any changes to their behaviour. The window title in-app still shows `"Fetch Boy 🦴"` on all platforms.
5. **Local Windows parity documented**: the Dev Notes section of this story documents exactly how to run `tauri build` locally on Windows so a contributor with a Windows machine can reproduce the result.
6. **CI workflow unchanged in structure**: no matrix jobs are added or removed — only the config files (`tauri.conf.json`, optionally `Cargo.toml`) are changed. `build.yml` itself requires no edits unless the Windows size-check path pattern needs fixing.

## Tasks / Subtasks

- [ ] Task 1 — Fix `productName` emoji breakage on Windows (AC: 1, 4)
  - [ ] Open `dispatch/src-tauri/tauri.conf.json`.
  - [ ] Change `"productName"` from `"Fetch Boy 🦴"` → `"Fetch Boy"` (ASCII-only).
  - [ ] **Do NOT change** `app.windows[0].title` — keep it as `"Fetch Boy 🦴"` so the in-app window title still shows the emoji.
  - [ ] Final `tauri.conf.json` top-level fields should look like:
    ```json
    {
      "$schema": "https://schema.tauri.app/config/2",
      "productName": "Fetch Boy",
      "version": "0.1.0",
      "identifier": "com.dispatch.app",
      ...
      "app": {
        "windows": [
          {
            "title": "Fetch Boy 🦴",
            ...
          }
        ],
        ...
      }
    }
    ```
  - [ ] Verify the dev server still starts: `cd dispatch && yarn tauri dev` — window title should still say `"Fetch Boy 🦴"`.

- [ ] Task 2 — Add NSIS-specific bundle config (AC: 2)
  - [ ] Open `dispatch/src-tauri/tauri.conf.json`.
  - [ ] Add a `bundle.windows` section inside the existing `bundle` object to pin the installer format to NSIS (prevents WiX MSI failures on runners without the WiX Toolset):
    ```json
    "bundle": {
      "active": true,
      "targets": "all",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "windows": {
        "nsis": {}
      }
    }
    ```
  - [ ] The empty `nsis: {}` object tells Tauri to include NSIS as a target using all defaults. No further NSIS config is needed.

- [ ] Task 3 — Verify size-check step covers NSIS `.exe` (AC: 3)
  - [ ] Open `.github/workflows/build.yml`.
  - [ ] Locate the `Check bundle sizes (Windows)` step. Confirm it uses:
    ```powershell
    Get-ChildItem -Path dispatch\src-tauri\target\release\bundle -Recurse -Include *.msi,*.exe
    ```
  - [ ] This pattern already covers NSIS `.exe` — **no changes required** unless the pattern is missing `.exe`.
  - [ ] If `.exe` is absent from the `-Include` list, add it. Otherwise mark this task done as-is.

- [ ] Task 4 — Verify `upload-artifact` step covers NSIS `.exe` (AC: 2)
  - [ ] Open `.github/workflows/build.yml`.
  - [ ] Confirm the `Upload installers` step path glob includes `**/*.exe`.
    - It already does: `dispatch/src-tauri/target/release/bundle/**/*.exe` — **no changes needed**.
  - [ ] If missing, add `dispatch/src-tauri/target/release/bundle/**/*.exe` to the `path:` block.

- [ ] Task 5 — Document Windows local build steps (AC: 5)
  - [ ] Add the "Local Windows Build" section to Dev Notes in this story (already present below — no file edits needed; this satisfies the AC).

- [ ] Final Task — Commit story changes
  - [ ] Commit `dispatch/src-tauri/tauri.conf.json` with:
    ```
    feat: Story 4.5 - Windows Build Compatibility (fix productName emoji, add NSIS config)
    ```

## Dev Notes

### Root Cause: Emoji in `productName` Breaks Windows NSIS

Tauri v2's NSIS bundler uses `productName` to construct:
- The installer window title
- The default installation path: `C:\Users\<user>\AppData\Local\<productName>`
- Registry keys written during installation

NSIS historically has poor support for non-BMP Unicode (emoji are above U+FFFF). The `🦴` character (U+1F9B4) is a 4-byte UTF-16 surrogate pair. NSIS may:
- Silently corrupt the path
- Fail with `Error in script "installer.nsi" on line X — expected variable name`
- Produce an installer that crashes on Windows machines with ANSI system locale

**Fix:** separate `productName` (installer metadata, must be ASCII-friendly) from the window `title` (in-app display, fully supports Unicode).

### Tauri v2 Config Reference

Relevant `tauri.conf.json` sections and what they control:

| Field | Purpose | Windows impact |
|---|---|---|
| `productName` | Installer metadata, registry key, install path | MUST be ASCII-only |
| `app.windows[].title` | OS window titlebar | Unicode fine, keep emoji here |
| `identifier` | Bundle ID / registry root key | Must be reverse-DNS format, already `com.dispatch.app` |
| `bundle.targets` | Which installers to build | `"all"` is fine — Tauri selects format appropriate per OS |
| `bundle.windows.nsis` | NSIS-specific options | `{}` uses all defaults (compression, install path, etc.) |

### NSIS vs WiX MSI (Tauri v2)

In Tauri v2, Windows builds default to **NSIS** (not WiX). WiX requires the WiX Toolset v3 or v4 installed on the build runner. The GitHub Actions `windows-latest` runner does **not** have WiX installed by default.

- NSIS: ships with Tauri (no extra tools needed), produces `.exe` — ✅ works on `windows-latest`
- WiX MSI: requires `wix` toolset, produces `.msi` — ❌ needs extra setup step in CI

Using `bundle.windows.nsis: {}` pins the target to NSIS, eliminating the risk of Tauri attempting WiX and failing. This does not affect macOS or Linux builds.

### WebView2 and the Windows Installer

Tauri v2 NSIS installer automatically handles WebView2 in one of two ways:
1. **Bootstrap mode** (default): installer downloads and installs WebView2 at install time if not already present. Size impact: ~0 bytes (downloader only).
2. **Embed mode**: bundles the full WebView2 Runtime (~150 MB) — NOT used here; this would violate the 15 MB limit.

`windows-latest` on GitHub Actions already has WebView2 installed, so CI builds succeed without any WebView2 config.

### Local Windows Build Prerequisites

For a contributor building on Windows:

```powershell
# 1. Install Rust (MSVC toolchain)
winget install Rustlang.Rust.MSVC

# 2. Install Node.js v20
winget install OpenJS.NodeJS.LTS

# 3. Install Yarn
npm install -g yarn

# 4. Install Visual Studio Build Tools (C++ workload required for Rust MSVC)
winget install Microsoft.VisualStudio.2022.BuildTools
# Select: "Desktop development with C++"

# 5. Build
cd dispatch
yarn install
yarn tauri build
```

Expected output: `dispatch/src-tauri/target/release/bundle/nsis/Fetch Boy_0.1.0_x64-setup.exe`

> Note: the installer filename is derived from `productName`. After the fix in Task 1, it will be
> `Fetch Boy_0.1.0_x64-setup.exe` (no emoji). Before the fix it was
> `Fetch Boy 🦴_0.1.0_x64-setup.exe` which may fail or produce a corrupt filename.

### Relationship to Story 4.4

Story 4.4 created the GitHub Actions matrix workflow and verified the macOS build locally. Story 4.4 explicitly noted:

> "If the CI Windows job fails on the product name, rename to `Fetch Boy` (without emoji) as the fallback."

This story executes that fallback proactively rather than reactively, ensuring the Windows CI job passes before it is ever pushed to `main`.

### Files Changed in This Story

| File | Change |
|---|---|
| `dispatch/src-tauri/tauri.conf.json` | Remove emoji from `productName`; add `bundle.windows.nsis: {}` |
| `.github/workflows/build.yml` | No change expected (size-check and upload already cover `.exe`) |

### Project Structure Notes

- All changes are in `dispatch/src-tauri/tauri.conf.json` only (configuration, not source code)
- No Rust source files, React components, or hooks are touched
- No migrations or schema changes
- `bundle.windows` is a new top-level key inside `bundle` — Tauri v2 schema validates this correctly

### References

- [Source: dispatch/src-tauri/tauri.conf.json] — current `productName` with emoji
- [Source: .github/workflows/build.yml] — existing Windows CI matrix job and size checks
- [Source: _bmad-output/implementation-artifacts/4-4-app-packaging-and-installers.md#Emoji in Product Name] — original warning
- [Tauri v2 NSIS config](https://v2.tauri.app/reference/config/#nsis) — `bundle.windows.nsis` options
- [Tauri v2 Windows guide](https://v2.tauri.app/distribute/sign/windows/) — code signing (out of scope for this story)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5

### Debug Log References

### Completion Notes List

### File List

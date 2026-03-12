# Story 9.5: Proxy & Certificate Installation Wizard

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to easily set up HTTPS interception without manually configuring system settings,
so that I can start intercepting traffic with minimal friction.

## Acceptance Criteria

1. **Install Certificate Button**
   - [x] Button in Intercept sidebar attempts to install the CA certificate to the OS
   - [x] On macOS: Uses `security add-trusted-cert` command
   - [x] On Windows: Uses PowerShell or certutil to import the certificate
   - [x] Shows success/error feedback to the user
   - [x] Button is disabled/hidden if certificate is already installed

2. **Configure Proxy Button**
   - [x] Button in Intercept sidebar attempts to configure the OS to use the proxy
   - [x] On macOS: Uses `networksetup -setwebproxy` and `networksetup -setsecurewebproxy`
   - [x] On Windows: Uses registry or netsh to set system proxy
   - [x] Shows success/error feedback to the user
   - [x] Button is disabled/hidden if proxy is already configured

3. **UI Requirements**
   - [x] Both buttons visible in Intercept sidebar settings accordion
   - [x] Buttons styled consistently with other sidebar buttons
   - [x] Clear visual feedback for installation/configuration status

## Tasks / Subtasks

- [x] Task 1: Add certificate installation Rust backend command (AC: 1)
  - [x] Subtask 1.1: Add install_ca_to_system function in Rust
  - [x] Subtask 1.2: Handle macOS certificate installation
  - [x] Subtask 1.3: Handle Windows certificate installation
  - [x] Subtask 1.4: Add tauri command to frontend
- [x] Task 2: Add proxy configuration Rust backend command (AC: 2)
  - [x] Subtask 2.1: Add configure_proxy function in Rust
  - [x] Subtask 2.2: Handle macOS proxy configuration
  - [x] Subtask 2.3: Handle Windows proxy configuration
  - [x] Subtask 2.4: Add tauri command to frontend
- [x] Task 3: Update InterceptSidebar UI (AC: 3)
  - [x] Subtask 3.1: Add buttons to sidebar
  - [x] Subtask 3.2: Add proper styling
  - [x] Subtask 3.3: Add loading/success/error states
- [x] Task 4 - Commit story changes
  - [x] Commit all code and documentation changes for this story with a message that includes Story 9.5

## Dev Notes

- Relevant architecture patterns and constraints
- Source tree components to touch
- Testing standards summary

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming)
- Detected conflicts or variances (with rationale)

### References

- Cite all technical details with source paths and sections, e.g. [Source: docs/<file>.md#Section]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- **Task 1 (Install CA):** Added `install_ca_to_system` Tauri command in `lib.rs` that delegates to `cert::CertificateAuthority::load_or_create` + `install_to_system`. Added `is_ca_installed` command that uses `security find-certificate` on macOS and `certutil -store` on Windows to check if the cert is already trusted. Both commands registered in `invoke_handler`.
- **Task 2 (Configure Proxy):** Added `configure_system_proxy` command that lists all enabled network services via `networksetup -listallnetworkservices` and calls `-setwebproxy` + `-setsecurewebproxy` for each on macOS; uses `netsh winhttp set proxy` on Windows. Added `is_system_proxy_configured` command that checks proxy status per network service on macOS and `netsh winhttp show proxy` on Windows.
- **Task 3 (UI):** Updated `InterceptSidebar.tsx` to include a "Setup" section with two buttons — "Install Certificate" (ShieldCheck icon) and "Configure Proxy" (Globe icon). Both buttons show disabled state when already installed/configured, a loading label during the async operation, and a success (green) or error (red) message below. Status is checked on mount via `is_ca_installed` and `is_system_proxy_configured`.
- All 12 Rust tests and 578 frontend tests pass with no regressions.

### File List

- fetch-boy/src-tauri/src/lib.rs
- fetch-boy/src/components/Intercept view/InterceptSidebar.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/9-5-proxy-install-wizard.md

## Change Log

- 2026-03-12: Story 9.5 implemented — added `install_ca_to_system`, `is_ca_installed`, `configure_system_proxy`, `is_system_proxy_configured` Tauri commands and corresponding UI buttons with loading/success/error states in InterceptSidebar.

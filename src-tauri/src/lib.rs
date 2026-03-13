mod cert;
mod db;
mod http;
mod proxy;

use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Emitter, Manager};

// ─── App State ────────────────────────────────────────────────────────────────

/// Wraps the running proxy server (None if proxy is disabled).
pub struct ProxyState(pub std::sync::Mutex<Option<proxy::ProxyServer>>);

/// Persistent info needed to restart the proxy after a config change.
pub struct ProxyRestartInfo {
    pub app_data_dir: PathBuf,
    pub emit_fn: proxy::EmitFn,
    pub paused_emit_fn: proxy::PausedEmitFn,
}

/// Current proxy configuration (port + enabled flag).
pub struct ProxyConfigState {
    pub port: std::sync::Mutex<u16>,
    pub enabled: std::sync::Mutex<bool>,
}

/// Shared breakpoint rules — kept in sync via the sync_breakpoints command.
pub struct BreakpointsState(pub proxy::BreakpointsRef);

/// Pause registry — maps request_id to a oneshot sender so Tauri commands can resume paused proxy handlers.
pub struct PauseRegistryState(pub proxy::PauseRegistryRef);

/// Configurable pause timeout in seconds (0 = never).
pub struct PauseTimeoutState(pub proxy::PauseTimeoutRef);

// ─── Proxy commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn get_proxy_config(config: tauri::State<'_, ProxyConfigState>) -> serde_json::Value {
    let port = *config.port.lock().unwrap();
    let enabled = *config.enabled.lock().unwrap();
    serde_json::json!({ "port": port, "enabled": enabled })
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open folder: {}", e))
}

#[tauri::command]
fn get_ca_certificate_path(restart_info: tauri::State<'_, ProxyRestartInfo>) -> serde_json::Value {
    let ca_dir = restart_info.app_data_dir.join("ca");
    let cert_path = ca_dir.join("ca.pem");
    serde_json::json!({
        "certPath": cert_path.to_string_lossy(),
        "certExists": cert_path.exists()
    })
}

#[tauri::command]
fn set_proxy_config(
    enabled: bool,
    port: u16,
    config: tauri::State<'_, ProxyConfigState>,
    proxy_state: tauri::State<'_, ProxyState>,
    restart_info: tauri::State<'_, ProxyRestartInfo>,
    breakpoints: tauri::State<'_, BreakpointsState>,
    pause_registry: tauri::State<'_, PauseRegistryState>,
    pause_timeout: tauri::State<'_, PauseTimeoutState>,
) -> Result<(), String> {
    // Update stored config.
    *config.port.lock().unwrap() = port;
    *config.enabled.lock().unwrap() = enabled;

    // Stop any running proxy.
    {
        let mut opt = proxy_state.0.lock().unwrap();
        if let Some(ref mut p) = *opt {
            p.stop();
        }
        *opt = None;
    }

    // If disabling, drop any requests paused at breakpoints so their async handlers
    // complete immediately and the proxy can actually shut down. Without this, paused
    // handlers block indefinitely (especially with timeout = 0), keeping the proxy alive.
    if !enabled {
        let mut registry = pause_registry.0.lock().unwrap();
        for (_, tx) in registry.drain() {
            let _ = tx.send(proxy::PauseDecision::Drop);
        }
    }

    // Restart on the new port if enabled.
    if enabled {
        let ca = cert::CertificateAuthority::load_or_create(restart_info.app_data_dir.clone())
            .map_err(|e| format!("Failed to load CA for proxy restart: {e}"))?;

        let ca_authority = ca.into_authority();
        let mut new_proxy = proxy::ProxyServer::new(port);
        new_proxy.start(
            ca_authority,
            Arc::clone(&restart_info.emit_fn),
            Arc::clone(&restart_info.paused_emit_fn),
            Arc::clone(&breakpoints.0),
            Arc::clone(&pause_registry.0),
            Arc::clone(&pause_timeout.0),
        );
        *proxy_state.0.lock().unwrap() = Some(new_proxy);
    }

    Ok(())
}

// ─── Certificate & Proxy installation commands ───────────────────────────────

#[tauri::command]
fn install_ca_to_system(
    app: tauri::AppHandle,
    restart_info: tauri::State<'_, ProxyRestartInfo>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;

        let _ = app; // icon resolved via system caution icon instead

        // Pre-confirmation dialog. AppleScript line breaks use `& return &`;
        // `with icon caution` shows the native macOS warning triangle.
        let pre_dialog =
            "display dialog \
             \"FetchBoy needs to install its CA certificate to your keychain.\" \
             & return & return & \
             \"This lets FetchBoy intercept and inspect HTTPS traffic on this device.\" \
             & return & return & \
             \"macOS may ask you to confirm access to your keychain.\" \
             with title \"FetchBoy \u{2014} Install CA Certificate\" \
             buttons {\"Cancel\", \"Install\"} \
             default button \"Install\" \
             cancel button \"Cancel\" \
             with icon caution";

        let confirm = std::process::Command::new("osascript")
            .args(["-e", pre_dialog])
            .current_dir("/tmp")
            .output()
            .map_err(|e| format!("Failed to show dialog: {e}"))?;

        if !confirm.status.success() {
            return Err("Installation cancelled.".to_string());
        }

        // User confirmed — run the install directly from the app process.
        // Running `security` directly (not through `do shell script with administrator
        // privileges`) lets macOS show its own interactive auth dialog, which supports
        // Touch ID and avoids the "no user interaction was possible" sandbox restriction.
        cert::CertificateAuthority::load_or_create(restart_info.app_data_dir.clone())
            .map_err(|e| format!("Failed to load CA: {e}"))?;

        let cert_path = restart_info.app_data_dir.join("ca").join("ca.pem");

        // Two-step install into the user's login keychain (no admin required).
        // Step 1: import the cert file into the login keychain.
        // Step 2: mark it as a trusted root so macOS SecTrust honours it for SSL.
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/Shared".to_string());
        let login_keychain = format!("{}/Library/Keychains/login.keychain-db", home);
        let cert_str = cert_path.to_string_lossy();

        let import = std::process::Command::new("/usr/bin/security")
            .args([
                "import", &cert_str,
                "-k", &login_keychain,
                "-A",          // allow any app to access without prompting
                "-T", "/usr/bin/security",
            ])
            .current_dir("/tmp")
            .output()
            .map_err(|e| format!("Failed to import certificate: {e}"))?;

        // Exit code 1 with "already exists" is fine — cert was previously imported.
        let import_err = String::from_utf8_lossy(&import.stderr);
        if !import.status.success() && !import_err.contains("already exists") {
            return Err(format!("Certificate import failed: {}", import_err));
        }

        let trust = std::process::Command::new("/usr/bin/security")
            .args([
                "add-trusted-cert",
                "-r", "trustRoot",
                "-p", "ssl",
                "-k", &login_keychain,
                &cert_str,
            ])
            .current_dir("/tmp")
            .output()
            .map_err(|e| format!("Failed to set certificate trust: {e}"))?;

        if !trust.status.success() {
            return Err(format!(
                "Certificate trust failed: {}",
                String::from_utf8_lossy(&trust.stderr)
            ));
        }

        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let ca = cert::CertificateAuthority::load_or_create(restart_info.app_data_dir.clone())
            .map_err(|e| format!("Failed to load CA: {e}"))?;
        ca.install_to_system().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn uninstall_ca_from_system(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;

        let pre_dialog =
            "display dialog \
             \"This will remove the FetchBoy CA certificate from your keychain.\" \
             & return & return & \
             \"HTTPS interception will stop working until the certificate is reinstalled.\" \
             with title \"FetchBoy \u{2014} Remove CA Certificate\" \
             buttons {\"Cancel\", \"Remove\"} \
             default button \"Remove\" \
             cancel button \"Cancel\" \
             with icon caution";

        let confirm = std::process::Command::new("osascript")
            .args(["-e", pre_dialog])
            .current_dir("/tmp")
            .output()
            .map_err(|e| format!("Failed to show dialog: {e}"))?;

        if !confirm.status.success() {
            return Err("Removal cancelled.".to_string());
        }

        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/Shared".to_string());
        let login_keychain = format!("{}/Library/Keychains/login.keychain-db", home);

        // First, try to find the certificate by common name and get its SHA-1 hash
        let find_result = std::process::Command::new("/usr/bin/security")
            .args([
                "find-certificate",
                "-c", "FetchBoy Proxy CA",
                "-p",  // Print certificate info in PEM format
                &login_keychain,
            ])
            .current_dir("/tmp")
            .output()
            .map_err(|e| format!("Failed to find certificate: {}", e))?;

        if !find_result.status.success() {
            // Certificate not found - might already be removed
            let stderr = String::from_utf8_lossy(&find_result.stderr);
            if stderr.contains("unable to find") || stderr.contains("not found") {
                return Ok(());
            }
            return Err(format!(
                "Failed to find certificate: {}",
                stderr
            ));
        }

        // Get the SHA-1 hash of the certificate using security command
        let hash_result = std::process::Command::new("/usr/bin/security")
            .args([
                "find-certificate",
                "-c", "FetchBoy Proxy CA",
                "-Z",  // Print SHA-1 hash
                &login_keychain,
            ])
            .current_dir("/tmp")
            .output()
            .map_err(|e| format!("Failed to get certificate hash: {}", e))?;

        if !hash_result.status.success() {
            // Fallback: try deleting by common name
            return uninstall_by_common_name(&login_keychain);
        }

        let hash_output = String::from_utf8_lossy(&hash_result.stdout);
        // Extract the SHA-1 hash from the output (format: "SHA-1 hash: XX:XX:XX:...")
        let hash_part = hash_output
            .lines()
            .find(|l| l.contains("SHA-1 hash:"))
            .and_then(|l| l.split("SHA-1 hash:").nth(1))
            .map(|s| s.trim().replace(":", ""))
            .unwrap_or_default();

        if hash_part.is_empty() {
            return uninstall_by_common_name(&login_keychain);
        }

        // Delete by hash
        let delete_result = std::process::Command::new("/usr/bin/security")
            .args(["delete-certificate", "-Z", &hash_part, &login_keychain])
            .current_dir("/tmp")
            .output()
            .map_err(|e| format!("Failed to delete certificate by hash: {}", e))?;

        if !delete_result.status.success() {
            // Fallback to common name if hash deletion fails
            return uninstall_by_common_name(&login_keychain);
        }

        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("Certificate removal not supported on this platform".to_string())
    }
}

/// Helper function to uninstall certificate by common name as fallback
#[cfg(target_os = "macos")]
fn uninstall_by_common_name(keychain: &str) -> Result<(), String> {
    let result = std::process::Command::new("/usr/bin/security")
        .args(["delete-certificate", "-c", "FetchBoy Proxy CA", keychain])
        .current_dir("/tmp")
        .output()
        .map_err(|e| format!("Failed to run security command: {}", e))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        // If cert not found, that's OK - it might have already been removed
        if stderr.contains("unable to find") || stderr.contains("not found") {
            return Ok(());
        }
        return Err(format!(
            "Certificate removal failed: {}",
            stderr
        ));
    }

    Ok(())
}

#[tauri::command]
fn is_ca_installed() -> bool {
    #[cfg(target_os = "macos")]
    {
        // Search all keychains in the default search list (user + system).
        std::process::Command::new("/usr/bin/security")
            .args(["find-certificate", "-c", "FetchBoy Proxy CA"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("certutil")
            .args(["-store", "-user", "Root", "FetchBoy Proxy CA"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

#[tauri::command]
fn configure_system_proxy(port: u16) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let services_out = std::process::Command::new("networksetup")
            .args(["-listallnetworkservices"])
            .output()
            .map_err(|e| format!("Failed to list network services: {e}"))?;

        let services_text = String::from_utf8_lossy(&services_out.stdout);
        // First line is a header; skip it. Lines starting with '*' are disabled services.
        let services: Vec<&str> = services_text
            .lines()
            .skip(1)
            .filter(|s| !s.starts_with('*') && !s.trim().is_empty())
            .collect();

        let port_str = port.to_string();
        let mut last_err: Option<String> = None;

        for service in &services {
            let http = std::process::Command::new("networksetup")
                .args(["-setwebproxy", service, "127.0.0.1", &port_str])
                .output()
                .map_err(|e| format!("Failed to set HTTP proxy for {service}: {e}"))?;
            if !http.status.success() {
                last_err = Some(format!(
                    "HTTP proxy set failed for {service}: {}",
                    String::from_utf8_lossy(&http.stderr)
                ));
                continue;
            }

            let https = std::process::Command::new("networksetup")
                .args(["-setsecurewebproxy", service, "127.0.0.1", &port_str])
                .output()
                .map_err(|e| format!("Failed to set HTTPS proxy for {service}: {e}"))?;
            if !https.status.success() {
                last_err = Some(format!(
                    "HTTPS proxy set failed for {service}: {}",
                    String::from_utf8_lossy(&https.stderr)
                ));
            }
        }

        if let Some(err) = last_err {
            Err(err)
        } else {
            Ok(())
        }
    }
    #[cfg(target_os = "windows")]
    {
        let proxy_str = format!("127.0.0.1:{}", port);
        // Write to HKCU (no admin required); browsers read this via WinInet.
        let set_server = std::process::Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyServer",
                "/t", "REG_SZ",
                "/d", &proxy_str,
                "/f",
            ])
            .output()
            .map_err(|e| format!("Failed to set proxy server: {e}"))?;
        if !set_server.status.success() {
            return Err(format!(
                "reg add ProxyServer failed: {}",
                String::from_utf8_lossy(&set_server.stderr)
            ));
        }
        let set_enable = std::process::Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyEnable",
                "/t", "REG_DWORD",
                "/d", "1",
                "/f",
            ])
            .output()
            .map_err(|e| format!("Failed to enable proxy: {e}"))?;
        if !set_enable.status.success() {
            return Err(format!(
                "reg add ProxyEnable failed: {}",
                String::from_utf8_lossy(&set_enable.stderr)
            ));
        }
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Proxy configuration not supported on this platform".to_string())
    }
}

#[tauri::command]
fn is_system_proxy_configured(port: u16) -> bool {
    #[cfg(target_os = "macos")]
    {
        // Check the first enabled network service for proxy configuration.
        let services_out = std::process::Command::new("networksetup")
            .args(["-listallnetworkservices"])
            .output();
        let Ok(services_out) = services_out else {
            return false;
        };
        let services_text = String::from_utf8_lossy(&services_out.stdout);
        let services: Vec<&str> = services_text
            .lines()
            .skip(1)
            .filter(|s| !s.starts_with('*') && !s.trim().is_empty())
            .collect();

        let port_str = format!("Port: {port}");
        for service in services {
            let out = std::process::Command::new("networksetup")
                .args(["-getwebproxy", service])
                .output();
            if let Ok(out) = out {
                let text = String::from_utf8_lossy(&out.stdout);
                if text.contains("Enabled: Yes") && text.contains(&port_str) {
                    return true;
                }
            }
        }
        false
    }
    #[cfg(target_os = "windows")]
    {
        // Check HKCU WinInet settings — same place browsers (Chrome/Edge) read from.
        let enabled = std::process::Command::new("reg")
            .args([
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyEnable",
            ])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains("0x1"))
            .unwrap_or(false);
        if !enabled {
            return false;
        }
        std::process::Command::new("reg")
            .args([
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyServer",
            ])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains(&format!("127.0.0.1:{}", port)))
            .unwrap_or(false)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

#[tauri::command]
fn unconfigure_system_proxy() -> Result<(), String> {
    disable_os_proxy_all_services();
    Ok(())
}

// ─── OS proxy helpers ─────────────────────────────────────────────────────────

/// Disable the system-level proxy on all active network services.
/// Safe to call from any context (exit handler, command, etc.).
fn disable_os_proxy_all_services() {
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = std::process::Command::new("networksetup")
            .args(["-listallnetworkservices"])
            .current_dir("/tmp")
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            for service in text
                .lines()
                .skip(1)
                .filter(|s| !s.starts_with('*') && !s.trim().is_empty())
            {
                let _ = std::process::Command::new("networksetup")
                    .args(["-setwebproxystate", service, "off"])
                    .current_dir("/tmp")
                    .output();
                let _ = std::process::Command::new("networksetup")
                    .args(["-setsecurewebproxystate", service, "off"])
                    .current_dir("/tmp")
                    .output();
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyEnable",
                "/t", "REG_DWORD",
                "/d", "0",
                "/f",
            ])
            .output();
    }
}

// ─── URL Matching command ────────────────────────────────────────────────────

#[tauri::command]
fn match_breakpoint_url(url: String, pattern: String, match_type: String) -> proxy::UrlMatchResult {
    proxy::match_url(&url, &pattern, &match_type)
}

// ─── Breakpoints sync command ─────────────────────────────────────────────────

#[tauri::command]
fn sync_breakpoints(
    breakpoints: Vec<proxy::BreakpointRule>,
    state: tauri::State<'_, BreakpointsState>,
) -> Result<(), String> {
    *state.0.lock().unwrap() = breakpoints;
    Ok(())
}

// ─── Pause / resume commands ──────────────────────────────────────────────────

/// Resume a paused request. `action` is "continue", "drop", or "modify".
/// When action is "modify", the modifications fields are applied to the response.
#[tauri::command]
fn resume_request(
    request_id: String,
    action: String,
    status_code: Option<u16>,
    response_body: Option<String>,
    content_type: Option<String>,
    extra_headers: Option<Vec<[String; 2]>>,
    state: tauri::State<'_, PauseRegistryState>,
) -> Result<(), String> {
    let decision = match action.as_str() {
        "drop" => proxy::PauseDecision::Drop,
        "modify" => proxy::PauseDecision::Modify(proxy::BreakpointModifications {
            status_code,
            response_body,
            content_type,
            headers: extra_headers.unwrap_or_default(),
        }),
        _ => proxy::PauseDecision::Continue,
    };

    let sender = state.0.lock().unwrap().remove(&request_id);
    if let Some(tx) = sender {
        let _ = tx.send(decision);
    }
    Ok(())
}

/// Get and set the pause timeout (seconds; 0 = never timeout).
#[tauri::command]
fn get_pause_timeout(state: tauri::State<'_, PauseTimeoutState>) -> u64 {
    *state.0.lock().unwrap()
}

#[tauri::command]
fn set_pause_timeout(seconds: u64, state: tauri::State<'_, PauseTimeoutState>) {
    *state.0.lock().unwrap() = seconds;
}

// ─── Exit command ─────────────────────────────────────────────────────────────

/// Stop the proxy and clear OS proxy settings, then exit the process.
/// Called from the frontend close handler so we bypass the JS window-close API
/// and guarantee the process actually terminates.
#[tauri::command]
fn exit_app(
    app: tauri::AppHandle,
    state: tauri::State<'_, ProxyState>,
) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut proxy) = guard.take() {
            proxy.stop();
        }
    }
    disable_os_proxy_all_services();
    app.exit(0);
}

// ─── App entry point ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:fetch-boy.db", db::migrations())
                .build(),
        )
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let app_handle = app.handle().clone();
            let emit_fn: proxy::EmitFn = Arc::new(move |event| {
                if let Err(e) = app_handle.emit("intercept:request", event) {
                    log::warn!("Failed to emit intercept event: {e}");
                }
            });

            let app_handle2 = app.handle().clone();
            let paused_emit_fn: proxy::PausedEmitFn = Arc::new(move |event| {
                if let Err(e) = app_handle2.emit("breakpoint:paused", event) {
                    log::warn!("Failed to emit breakpoint-paused event: {e}");
                }
            });

            // Register restart info so the set_proxy_config command can recreate the proxy.
            app.manage(ProxyRestartInfo {
                app_data_dir: app_data_dir.clone(),
                emit_fn: Arc::clone(&emit_fn),
                paused_emit_fn: Arc::clone(&paused_emit_fn),
            });

            // Default config: enabled on port 8080.
            app.manage(ProxyConfigState {
                port: std::sync::Mutex::new(8080),
                enabled: std::sync::Mutex::new(true),
            });

            // Shared breakpoints ref — populated at runtime via sync_breakpoints.
            let breakpoints_ref: proxy::BreakpointsRef =
                Arc::new(std::sync::Mutex::new(Vec::new()));
            app.manage(BreakpointsState(Arc::clone(&breakpoints_ref)));

            // Pause registry and timeout state.
            let pause_registry_ref: proxy::PauseRegistryRef =
                Arc::new(std::sync::Mutex::new(std::collections::HashMap::new()));
            let pause_timeout_ref: proxy::PauseTimeoutRef = Arc::new(std::sync::Mutex::new(30));
            app.manage(PauseRegistryState(Arc::clone(&pause_registry_ref)));
            app.manage(PauseTimeoutState(Arc::clone(&pause_timeout_ref)));

            // Initialise the CA and start the proxy.
            match cert::CertificateAuthority::load_or_create(app_data_dir) {
                Ok(ca) => {
                    let ca_authority = ca.into_authority();
                    let mut proxy = proxy::ProxyServer::new(8080);
                    proxy.start(
                        ca_authority,
                        emit_fn,
                        paused_emit_fn,
                        breakpoints_ref,
                        pause_registry_ref,
                        pause_timeout_ref,
                    );
                    app.manage(ProxyState(std::sync::Mutex::new(Some(proxy))));
                }
                Err(e) => {
                    log::error!("MITM proxy CA initialisation failed — proxy disabled: {e}");
                    app.manage(ProxyState(std::sync::Mutex::new(None)));
                    *app.state::<ProxyConfigState>().enabled.lock().unwrap() = false;
                }
            }

            Ok(())
        })
        .manage(http::CancellationRegistry(std::sync::Mutex::new(
            std::collections::HashMap::new(),
        )))
        .invoke_handler(tauri::generate_handler![
            http::send_request,
            http::cancel_request,
            get_proxy_config,
            set_proxy_config,
            get_ca_certificate_path,
            open_folder,
            install_ca_to_system,
            uninstall_ca_from_system,
            is_ca_installed,
            configure_system_proxy,
            unconfigure_system_proxy,
            is_system_proxy_configured,
            match_breakpoint_url,
            sync_breakpoints,
            resume_request,
            get_pause_timeout,
            set_pause_timeout,
            exit_app
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Stop the proxy server gracefully before the process dies.
                if let Ok(mut guard) = app_handle.state::<ProxyState>().0.lock() {
                    if let Some(mut proxy) = guard.take() {
                        proxy.stop();
                    }
                }
                // Ensure OS-level proxy settings are cleared regardless.
                disable_os_proxy_all_services();
            }
        });
}

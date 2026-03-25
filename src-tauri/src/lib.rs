mod cert;
mod db;
mod http;
mod proxy;

use std::path::PathBuf;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};

// ─── App State ────────────────────────────────────────────────────────────────

/// Wraps the running proxy server (None if proxy is disabled).
pub struct ProxyState(pub std::sync::Mutex<Option<proxy::ProxyServer>>);

/// Persistent info needed to restart the proxy after a config change.
pub struct ProxyRestartInfo {
    pub app_data_dir: PathBuf,
    pub emit_fn: proxy::EmitFn,
    pub paused_emit_fn: proxy::PausedEmitFn,
    pub request_emit_fn: proxy::RequestEmitFn,
    pub response_emit_fn: proxy::ResponseEmitFn,
}

/// Current proxy configuration (port + enabled flag).
pub struct ProxyConfigState {
    pub port: std::sync::Mutex<u16>,
    pub enabled: std::sync::Mutex<bool>,
}

/// Shared breakpoint rules — kept in sync via the sync_breakpoints command.
pub struct BreakpointsState(pub proxy::BreakpointsRef);

/// Shared mapping rules — kept in sync via the sync_mappings command.
pub struct MappingsState(pub proxy::MappingsRef);

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
            Arc::clone(&restart_info.request_emit_fn),
            Arc::clone(&restart_info.response_emit_fn),
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

        // Install into the admin trust domain (-d) so Chrome's Certificate Verifier
        // honours it. Writing to the System keychain requires admin privileges, so
        // we use AppleScript's "do shell script ... with administrator privileges"
        // which shows macOS's native password/Touch ID prompt.
        let cert_str = cert_path.to_string_lossy();

        let script = format!(
            "do shell script \"/usr/bin/security add-trusted-cert -r trustRoot -k /Library/Keychains/System.keychain '{}'\" with administrator privileges",
            cert_str.replace('\'', "'\\''")
        );

        let trust = std::process::Command::new("osascript")
            .args(["-e", &script])
            .current_dir("/tmp")
            .output()
            .map_err(|e| format!("Failed to set certificate trust: {e}"))?;

        if !trust.status.success() {
            let stderr = String::from_utf8_lossy(&trust.stderr);
            if stderr.contains("User canceled") || stderr.contains("(-128)") {
                return Err("Installation cancelled.".to_string());
            }
            return Err(format!(
                "Certificate trust failed: {}",
                stderr
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
fn uninstall_ca_from_system(
    app: tauri::AppHandle,
    restart_info: tauri::State<'_, ProxyRestartInfo>,
) -> Result<(), String> {
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

        // Remove from all keychains where the cert may exist.
        // Try System keychain first (where install now puts it), then login keychain (legacy).
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/Shared".to_string());
        let login_keychain = format!("{}/Library/Keychains/login.keychain-db", home);

        for keychain in ["/Library/Keychains/System.keychain", login_keychain.as_str()] {
            // Try to delete by common name — ignore errors (cert may not be in this keychain)
            let _ = std::process::Command::new("/usr/bin/security")
                .args(["delete-certificate", "-c", "FetchBoy Proxy CA", keychain])
                .current_dir("/tmp")
                .output();
        }

        // Also remove admin trust domain entries if cert file still exists
        let app_data_dir = restart_info.app_data_dir.clone();
        let cert_path = app_data_dir.join("ca").join("ca.pem");
        if cert_path.exists() {
            let _ = std::process::Command::new("/usr/bin/security")
                .args(["remove-trusted-cert", "-d", &cert_path.to_string_lossy()])
                .current_dir("/tmp")
                .output();
        }

        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("Certificate removal not supported on this platform".to_string())
    }
}

#[tauri::command]
fn delete_ca_files(restart_info: tauri::State<'_, ProxyRestartInfo>) -> Result<(), String> {
    let ca_dir = restart_info.app_data_dir.join("ca");
    let cert_path = ca_dir.join("ca.pem");
    let key_path = ca_dir.join("ca-key.pem");

    if cert_path.exists() {
        std::fs::remove_file(&cert_path)
            .map_err(|e| format!("Failed to delete ca.pem: {e}"))?;
    }
    if key_path.exists() {
        std::fs::remove_file(&key_path)
            .map_err(|e| format!("Failed to delete ca-key.pem: {e}"))?;
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

// ─── Mappings sync command ────────────────────────────────────────────────────

#[tauri::command]
fn sync_mappings(
    mappings: Vec<proxy::MappingRule>,
    state: tauri::State<'_, MappingsState>,
) -> Result<(), String> {
    *state.0.lock().unwrap() = mappings;
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

// ─── Menu ─────────────────────────────────────────────────────────────────────

fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let restart_tutorial = MenuItem::with_id(
        app,
        "restart-tutorial",
        "Restart Tutorial",
        true,
        None::<&str>,
    )?;
    let help_menu = Submenu::with_items(app, "Help", true, &[&restart_tutorial])?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    #[cfg(target_os = "macos")]
    {
        let app_menu = Submenu::with_items(
            app,
            "Fetch Boy",
            true,
            &[
                &PredefinedMenuItem::about(app, None, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ],
        )?;
        return Menu::with_items(app, &[&app_menu, &edit_menu, &help_menu]);
    }

    #[cfg(not(target_os = "macos"))]
    Menu::with_items(app, &[&edit_menu, &help_menu])
}

// ─── App entry point ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(build_menu)
        .on_menu_event(|app, event| {
            if event.id() == "restart-tutorial" {
                let _ = app.emit("menu:restart-tutorial", ());
            }
        })
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

            let app_handle3 = app.handle().clone();
            let request_emit_fn: proxy::RequestEmitFn = Arc::new(move |event| {
                if let Err(e) = app_handle3.emit("intercept:request-split", event) {
                    log::warn!("Failed to emit split request event: {e}");
                }
            });

            let app_handle4 = app.handle().clone();
            let response_emit_fn: proxy::ResponseEmitFn = Arc::new(move |event| {
                if let Err(e) = app_handle4.emit("intercept:response-split", event) {
                    log::warn!("Failed to emit split response event: {e}");
                }
            });

            // Register restart info so the set_proxy_config command can recreate the proxy.
            app.manage(ProxyRestartInfo {
                app_data_dir: app_data_dir.clone(),
                emit_fn: Arc::clone(&emit_fn),
                paused_emit_fn: Arc::clone(&paused_emit_fn),
                request_emit_fn: Arc::clone(&request_emit_fn),
                response_emit_fn: Arc::clone(&response_emit_fn),
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

            // Shared mappings ref — populated at runtime via sync_mappings.
            let mappings_ref: proxy::MappingsRef =
                Arc::new(std::sync::Mutex::new(Vec::new()));
            app.manage(MappingsState(Arc::clone(&mappings_ref)));

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
                        request_emit_fn,
                        response_emit_fn,
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
            delete_ca_files,
            is_ca_installed,
            configure_system_proxy,
            unconfigure_system_proxy,
            is_system_proxy_configured,
            match_breakpoint_url,
            sync_breakpoints,
            sync_mappings,
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

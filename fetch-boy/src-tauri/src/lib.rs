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
}

/// Current proxy configuration (port + enabled flag).
pub struct ProxyConfigState {
    pub port: std::sync::Mutex<u16>,
    pub enabled: std::sync::Mutex<bool>,
}

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

    // Restart on the new port if enabled.
    if enabled {
        let ca = cert::CertificateAuthority::load_or_create(restart_info.app_data_dir.clone())
            .map_err(|e| format!("Failed to load CA for proxy restart: {e}"))?;

        if let Err(e) = ca.install_to_system() {
            log::warn!("CA trust-store install skipped during proxy restart: {e}");
        }

        let ca_authority = ca.into_authority();
        let mut new_proxy = proxy::ProxyServer::new(port);
        new_proxy.start(ca_authority, Arc::clone(&restart_info.emit_fn));
        *proxy_state.0.lock().unwrap() = Some(new_proxy);
    }

    Ok(())
}

// ─── Certificate & Proxy installation commands ───────────────────────────────

#[tauri::command]
fn install_ca_to_system(restart_info: tauri::State<'_, ProxyRestartInfo>) -> Result<(), String> {
    let ca = cert::CertificateAuthority::load_or_create(restart_info.app_data_dir.clone())
        .map_err(|e| format!("Failed to load CA: {e}"))?;
    ca.install_to_system().map_err(|e| e.to_string())
}

#[tauri::command]
fn is_ca_installed() -> bool {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("security")
            .args([
                "find-certificate",
                "-c",
                "FetchBoy Proxy CA",
                "/Library/Keychains/System.keychain",
            ])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("certutil")
            .args(["-store", "Root", "FetchBoy Proxy CA"])
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
        let output = std::process::Command::new("netsh")
            .args(["winhttp", "set", "proxy", &proxy_str])
            .output()
            .map_err(|e| format!("Failed to configure proxy: {e}"))?;
        if !output.status.success() {
            return Err(format!(
                "netsh failed: {}",
                String::from_utf8_lossy(&output.stderr)
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
        let out = std::process::Command::new("netsh")
            .args(["winhttp", "show", "proxy"])
            .output();
        if let Ok(out) = out {
            let text = String::from_utf8_lossy(&out.stdout);
            text.contains(&format!("127.0.0.1:{}", port))
        } else {
            false
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
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

            // Register restart info so the set_proxy_config command can recreate the proxy.
            app.manage(ProxyRestartInfo {
                app_data_dir: app_data_dir.clone(),
                emit_fn: Arc::clone(&emit_fn),
            });

            // Default config: enabled on port 8080.
            app.manage(ProxyConfigState {
                port: std::sync::Mutex::new(8080),
                enabled: std::sync::Mutex::new(true),
            });

            // Initialise the CA and start the proxy.
            match cert::CertificateAuthority::load_or_create(app_data_dir) {
                Ok(ca) => {
                    if let Err(e) = ca.install_to_system() {
                        log::warn!(
                            "CA trust-store install failed (HTTPS interception may not work until the CA is trusted manually): {e}"
                        );
                    }
                    let ca_authority = ca.into_authority();
                    let mut proxy = proxy::ProxyServer::new(8080);
                    proxy.start(ca_authority, emit_fn);
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
            is_ca_installed,
            configure_system_proxy,
            is_system_proxy_configured
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

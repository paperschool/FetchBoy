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
            get_ca_certificate_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

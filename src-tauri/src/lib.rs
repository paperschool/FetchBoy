mod cert;
mod commands;
mod db;
mod debug_logger;
mod http;
mod platform;
mod proxy;

use serde::Serialize;
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
    pub paused_emit_fn: proxy::PausedEmitFn,
    pub request_emit_fn: proxy::RequestEmitFn,
    pub response_emit_fn: proxy::ResponseEmitFn,
    pub mapping_emit_fn: proxy::MappingEmitFn,
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

/// Debug logger for persisting events to log files.
pub struct DebugLoggerState(pub debug_logger::SharedDebugLogger);

// ─── Emit factory ─────────────────────────────────────────────────────────────

/// Create a type-safe emit closure that sends events to the frontend.
fn make_emit<T: Serialize + Clone + 'static>(
    handle: &tauri::AppHandle,
    event_name: &str,
) -> Arc<dyn Fn(&T) + Send + Sync + 'static> {
    let handle = handle.clone();
    let name = event_name.to_string();
    Arc::new(move |event: &T| {
        if let Err(e) = handle.emit(&name, event) {
            log::warn!("Failed to emit {name} event: {e}");
        }
    })
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

            // Initialise the debug logger for file persistence.
            let debug_logger: debug_logger::SharedDebugLogger = Arc::new(std::sync::Mutex::new(
                debug_logger::DebugLogger::new(&app_data_dir)
                    .expect("Failed to initialise debug logger")
            ));
            app.manage(DebugLoggerState(Arc::clone(&debug_logger)));

            // Helper: emit a debug:internal-event to the frontend.
            let debug_handle = app.handle().clone();
            let emit_debug = move |level: &str, source: &str, message: &str| {
                let payload = serde_json::json!({
                    "timestamp": std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                    "level": level,
                    "source": source,
                    "message": message,
                });
                let _ = debug_handle.emit("debug:internal-event", payload);
            };

            emit_debug("info", "app", "Debug logger initialised");

            // Build emit closures using factory for simple cases.
            let paused_emit_fn: proxy::PausedEmitFn = make_emit(app.handle(), "breakpoint:paused");

            // Request/response/mapping emit fns need additional debug logging.
            let logger_req = Arc::clone(&debug_logger);
            let emit_debug_req = emit_debug.clone();
            let request_emit_base: Arc<dyn Fn(&proxy::InterceptRequestEvent) + Send + Sync> =
                make_emit(app.handle(), "intercept:request-split");
            let request_emit_fn: proxy::RequestEmitFn = Arc::new(move |event| {
                request_emit_base(event);
                emit_debug_req("info", "proxy", &format!("REQ {} {}{}", event.method, event.host, event.path));
                if let Ok(mut logger) = logger_req.try_lock() {
                    logger.log_internal("INFO", "proxy", &format!("{} {}{}",
                        event.method, event.host, event.path));
                }
            });

            let logger_resp = Arc::clone(&debug_logger);
            let emit_debug_resp = emit_debug.clone();
            let response_emit_base: Arc<dyn Fn(&proxy::InterceptResponseEvent) + Send + Sync> =
                make_emit(app.handle(), "intercept:response-split");
            let response_emit_fn: proxy::ResponseEmitFn = Arc::new(move |event| {
                response_emit_base(event);
                emit_debug_resp("info", "proxy", &format!("RESP {} {} {}ms", event.id, event.status_code, event.response_time_ms));
                if let Ok(mut logger) = logger_resp.try_lock() {
                    logger.log_traffic(
                        "RESP",
                        &event.id,
                        event.status_code,
                        event.response_time_ms,
                    );
                }
            });

            let logger_mapping = Arc::clone(&debug_logger);
            let emit_debug_map = emit_debug.clone();
            let mapping_emit_base: Arc<dyn Fn(&proxy::MappingAppliedEvent) + Send + Sync> =
                make_emit(app.handle(), "mapping:applied");
            let mapping_emit_fn: proxy::MappingEmitFn = Arc::new(move |event| {
                mapping_emit_base(event);
                emit_debug_map("info", "mapping", &format!("Applied: {}", event.mapping_name));
                if let Ok(mut logger) = logger_mapping.try_lock() {
                    logger.log_internal("INFO", "mapping", &format!("applied: {}", event.mapping_name));
                }
            });

            let emit_debug_clone = emit_debug.clone();

            // Register restart info so the set_proxy_config command can recreate the proxy.
            app.manage(ProxyRestartInfo {
                app_data_dir: app_data_dir.clone(),
                paused_emit_fn: Arc::clone(&paused_emit_fn),
                request_emit_fn: Arc::clone(&request_emit_fn),
                response_emit_fn: Arc::clone(&response_emit_fn),
                mapping_emit_fn: Arc::clone(&mapping_emit_fn),
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
                    emit_debug_clone("info", "ca", "CA certificate loaded");
                    let ca_authority = ca.into_authority();
                    let mut proxy = proxy::ProxyServer::new(8080);
                    emit_debug_clone("info", "proxy", "Starting MITM proxy on port 8080");
                    proxy.start(
                        ca_authority,
                        paused_emit_fn,
                        request_emit_fn,
                        response_emit_fn,
                        mapping_emit_fn,
                        breakpoints_ref,
                        mappings_ref,
                        pause_registry_ref,
                        pause_timeout_ref,
                    );
                    app.manage(ProxyState(std::sync::Mutex::new(Some(proxy))));
                }
                Err(e) => {
                    log::error!("MITM proxy CA initialisation failed — proxy disabled: {e}");
                    emit_debug_clone("error", "ca", &format!("CA init failed — proxy disabled: {e}"));
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
            commands::get_proxy_config,
            commands::set_proxy_config,
            commands::get_ca_certificate_path,
            commands::open_folder,
            commands::install_ca_to_system,
            commands::uninstall_ca_from_system,
            commands::delete_ca_files,
            commands::is_ca_installed,
            commands::configure_system_proxy,
            commands::unconfigure_system_proxy,
            commands::is_system_proxy_configured,
            commands::match_breakpoint_url,
            commands::sync_breakpoints,
            commands::sync_mappings,
            commands::resume_request,
            commands::get_pause_timeout,
            commands::set_pause_timeout,
            commands::open_log_folder,
            commands::open_proxy_settings,
            commands::open_cert_manager,
            commands::exit_app
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
                platform::disable_os_proxy_all_services();
            }
        });
}

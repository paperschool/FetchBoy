use std::sync::Arc;

use crate::{
    BreakpointsState, MappingsState, PauseRegistryState, PauseTimeoutState,
    ProxyConfigState, ProxyRestartInfo, ProxyState,
};
use crate::{cert, proxy};

#[tauri::command]
pub fn get_proxy_config(config: tauri::State<'_, ProxyConfigState>) -> serde_json::Value {
    let port = *config.port.lock().unwrap();
    let enabled = *config.enabled.lock().unwrap();
    serde_json::json!({ "port": port, "enabled": enabled })
}

#[tauri::command]
pub fn set_proxy_config(
    enabled: bool,
    port: u16,
    config: tauri::State<'_, ProxyConfigState>,
    proxy_state: tauri::State<'_, ProxyState>,
    restart_info: tauri::State<'_, ProxyRestartInfo>,
    breakpoints: tauri::State<'_, BreakpointsState>,
    mappings_state: tauri::State<'_, MappingsState>,
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
            Arc::clone(&restart_info.paused_emit_fn),
            Arc::clone(&restart_info.request_emit_fn),
            Arc::clone(&restart_info.response_emit_fn),
            Arc::clone(&restart_info.mapping_emit_fn),
            Arc::clone(&breakpoints.0),
            Arc::clone(&mappings_state.0),
            Arc::clone(&pause_registry.0),
            Arc::clone(&pause_timeout.0),
        );
        *proxy_state.0.lock().unwrap() = Some(new_proxy);
    }

    Ok(())
}

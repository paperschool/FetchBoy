use std::sync::Arc;

use crate::{
    BreakpointsState, ChainRegistryState, ChainTimeoutState, MappingsState,
    PauseRegistryState, PauseTimeoutState, ProxyConfigState, ProxyRestartInfo, ProxyState,
};
use crate::{cert, proxy};

#[tauri::command]
pub fn get_proxy_config(config: tauri::State<'_, ProxyConfigState>) -> serde_json::Value {
    let port = *config.port.lock().unwrap();
    let enabled = *config.enabled.lock().unwrap();
    serde_json::json!({ "port": port, "enabled": enabled })
}

#[tauri::command]
pub async fn set_proxy_config(
    enabled: bool,
    port: u16,
    config: tauri::State<'_, ProxyConfigState>,
    proxy_state: tauri::State<'_, ProxyState>,
    restart_info: tauri::State<'_, ProxyRestartInfo>,
    breakpoints: tauri::State<'_, BreakpointsState>,
    mappings_state: tauri::State<'_, MappingsState>,
    pause_registry: tauri::State<'_, PauseRegistryState>,
    pause_timeout: tauri::State<'_, PauseTimeoutState>,
    chain_registry: tauri::State<'_, ChainRegistryState>,
    chain_timeout: tauri::State<'_, ChainTimeoutState>,
) -> Result<(), String> {
    // Update stored config.
    *config.port.lock().unwrap() = port;
    *config.enabled.lock().unwrap() = enabled;

    // Stop any running proxy and check whether one was active.
    let was_running = {
        let mut opt = proxy_state.0.lock().unwrap();
        let running = opt.is_some();
        if let Some(ref mut p) = *opt {
            p.stop();
        }
        *opt = None;
        running
    };

    // If disabling, drop any requests paused at breakpoints so their async handlers
    // complete immediately and the proxy can actually shut down. Without this, paused
    // handlers block indefinitely (especially with timeout = 0), keeping the proxy alive.
    if !enabled {
        let mut registry = pause_registry.0.lock().unwrap();
        for (_, tx) in registry.drain() {
            let _ = tx.send(proxy::PauseDecision::Drop);
        }
    }

    // Wait for the OS to release the port after graceful shutdown.
    if was_running {
        const MAX_RETRIES: u32 = 20;
        const RETRY_DELAY_MS: u64 = 50;
        for i in 0..MAX_RETRIES {
            if proxy::server::is_port_available(port) {
                break;
            }
            if i == MAX_RETRIES - 1 {
                return Err(format!(
                    "Port {} still in use after {}ms — try again shortly",
                    port, MAX_RETRIES as u64 * RETRY_DELAY_MS
                ));
            }
            tokio::time::sleep(std::time::Duration::from_millis(RETRY_DELAY_MS)).await;
        }
    }

    // Restart on the new port if enabled.
    if enabled {
        if !proxy::server::is_port_available(port) {
            return Err(format!("Port {} is already in use", port));
        }

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
            Arc::clone(&restart_info.chain_emit_fn),
            Arc::clone(&breakpoints.0),
            Arc::clone(&mappings_state.0),
            Arc::clone(&pause_registry.0),
            Arc::clone(&pause_timeout.0),
            Arc::clone(&chain_registry.0),
            Arc::clone(&chain_timeout.0),
        );
        *proxy_state.0.lock().unwrap() = Some(new_proxy);
    }

    Ok(())
}

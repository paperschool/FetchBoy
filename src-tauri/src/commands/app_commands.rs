use crate::ProxyState;
use crate::platform;

/// Stop the proxy and clear OS proxy settings, then exit the process.
/// Called from the frontend close handler so we bypass the JS window-close API
/// and guarantee the process actually terminates.
#[tauri::command]
pub fn exit_app(
    app: tauri::AppHandle,
    state: tauri::State<'_, ProxyState>,
) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut proxy) = guard.take() {
            proxy.stop();
        }
    }
    if let Err(e) = platform::disable_os_proxy_all_services() {
        log::error!("Failed to clear OS proxy on app exit: {e}");
    }
    app.exit(0);
}

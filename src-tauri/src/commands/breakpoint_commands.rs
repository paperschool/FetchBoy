use crate::{BreakpointsState, PauseRegistryState, PauseTimeoutState};
use crate::proxy;

#[tauri::command]
pub fn match_breakpoint_url(url: String, pattern: String, match_type: String) -> proxy::UrlMatchResult {
    proxy::match_url(&url, &pattern, &match_type)
}

#[tauri::command]
pub fn sync_breakpoints(
    breakpoints: Vec<proxy::BreakpointRule>,
    state: tauri::State<'_, BreakpointsState>,
) -> Result<(), String> {
    *state.0.lock().unwrap() = breakpoints;
    Ok(())
}

/// Resume a paused request. `action` is "continue", "drop", or "modify".
/// When action is "modify", the modifications fields are applied to the response.
#[tauri::command]
pub fn resume_request(
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

/// Get the pause timeout (seconds; 0 = never timeout).
#[tauri::command]
pub fn get_pause_timeout(state: tauri::State<'_, PauseTimeoutState>) -> u64 {
    *state.0.lock().unwrap()
}

#[tauri::command]
pub fn set_pause_timeout(seconds: u64, state: tauri::State<'_, PauseTimeoutState>) {
    *state.0.lock().unwrap() = seconds;
}

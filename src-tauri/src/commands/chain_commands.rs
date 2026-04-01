use std::collections::HashMap;

use crate::ChainRegistryState;
use crate::proxy;

/// Resume a chain execution. Called by the frontend after running a Stitch chain.
/// If `success` is false, sends None to signal fallthrough to the original response.
#[tauri::command]
pub fn resume_chain(
    request_id: String,
    success: bool,
    status: Option<u16>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
    body_content_type: Option<String>,
    state: tauri::State<'_, ChainRegistryState>,
) -> Result<(), String> {
    let result = if success {
        Some(proxy::ChainExecutionResult {
            status: status.unwrap_or(200),
            headers: headers.unwrap_or_default(),
            body: body.unwrap_or_default(),
            body_content_type: body_content_type.unwrap_or_else(|| "application/json".to_string()),
        })
    } else {
        None
    };

    let sender = state.0.lock().unwrap().remove(&request_id);
    if let Some(tx) = sender {
        let _ = tx.send(result);
    }
    Ok(())
}

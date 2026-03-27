use crate::MappingsState;
use crate::proxy;

#[tauri::command]
pub fn sync_mappings(
    mappings: Vec<proxy::MappingRule>,
    state: tauri::State<'_, MappingsState>,
) -> Result<(), String> {
    *state.0.lock().unwrap() = mappings;
    Ok(())
}

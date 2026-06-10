use crate::{IgnoreRulesState, MappingsState};
use crate::proxy;

#[tauri::command]
pub fn sync_mappings(
    mappings: Vec<proxy::MappingRule>,
    state: tauri::State<'_, MappingsState>,
) -> Result<(), String> {
    *state.0.lock().unwrap() = mappings;
    Ok(())
}

#[tauri::command]
pub fn sync_ignore_rules(
    ignore_rules: Vec<proxy::IgnoreRule>,
    state: tauri::State<'_, IgnoreRulesState>,
) -> Result<(), String> {
    *state.0.lock().unwrap() = ignore_rules;
    Ok(())
}

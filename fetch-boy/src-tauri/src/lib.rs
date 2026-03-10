mod db;
mod http;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Build the Tauri runtime by registering plugins and command handlers once.
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // Native HTTP plugin can be used for platform-level network calls.
        .plugin(tauri_plugin_http::init())
        // Shell plugin is used by existing app capabilities.
        .plugin(tauri_plugin_shell::init())
        .plugin(
            // SQL plugin initializes SQLite and applies migrations at startup.
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:fetch-boy.db", db::migrations())
                .build(),
        )
        // Expose Rust commands callable from the frontend via invoke().
        .invoke_handler(tauri::generate_handler![http::send_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

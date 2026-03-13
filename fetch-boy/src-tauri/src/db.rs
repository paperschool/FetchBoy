use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    // Return the ordered migration list consumed by tauri-plugin-sql at startup.
    vec![
        Migration {
            // Version numbers must increase monotonically as schema evolves.
            version: 1,
            description: "create_initial_tables",
            // Embed SQL at compile time so desktop builds carry migrations with the binary.
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_breakpoints_tables",
            sql: include_str!("../migrations/002_breakpoints.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_response_mapping_to_breakpoints",
            sql: include_str!("../migrations/003_response_mapping.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

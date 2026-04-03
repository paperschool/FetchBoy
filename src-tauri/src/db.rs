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
        Migration {
            version: 4,
            description: "add_status_headers_to_breakpoints",
            sql: include_str!("../migrations/004_status_headers.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_block_request_to_breakpoints",
            sql: include_str!("../migrations/005_block_request.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add_paused_requests_table",
            sql: include_str!("../migrations/006_paused_requests.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "create_mappings_tables",
            sql: include_str!("../migrations/007_mappings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add_default_environment_id_to_collections",
            sql: include_str!("../migrations/008_collection_default_environment.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "add_pre_request_scripts_to_requests",
            sql: include_str!("../migrations/009_pre_request_scripts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "create_stitch_tables",
            sql: include_str!("../migrations/010_stitch.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_parent_node_id_for_loop_nodes",
            sql: include_str!("../migrations/011_stitch_loop_node.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "add_mapping_chain_binding",
            sql: include_str!("../migrations/012_mapping_chain.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "create_script_templates_table",
            sql: include_str!("../migrations/013_script_templates.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

# Story 1.2: SQLite Schema and Migrations

Status: review

## Story

As a developer building Dispatch,
I want the SQLite database to be automatically created and migrated on first app launch via `tauri-plugin-sql`,
so that all subsequent stories have a reliable, typed local persistence layer to read from and write to.

## Acceptance Criteria

1. The database file `dispatch.db` is created in the platform data directory on first launch (requires Rust — see Dev Notes).
2. The following tables are created by migration v1: `collections`, `folders`, `requests`, `environments`, `history`, `settings`.
3. Every table schema matches the data models defined in `api-client-spec.md`.
4. A second app launch with an existing database starts without error and does not re-run already-applied migrations.
5. The TypeScript `db.ts` module exports typed interfaces for all six entities and a `getDb()` async singleton that resolves a live `Database` handle.
6. `tsc --noEmit` reports zero new errors after this story.
7. All new unit tests (mocking `@tauri-apps/plugin-sql`) pass.

Final Step: Commit all code and documentation changes for Story 1.2 before marking the story complete.

## Tasks / Subtasks

- [x] **Task 1 — Add `tauri-plugin-sql` dependencies** (AC: 1, 5)
  - [x] `yarn add @tauri-apps/plugin-sql`
  - [x] Add to `src-tauri/Cargo.toml`: `tauri-plugin-sql = { version = "2", features = ["sqlite"] }`
  - [x] Add `tauri-plugin-sql-allow-execute` + `tauri-plugin-sql-allow-load` to `src-tauri/capabilities/default.json`

- [x] **Task 2 — Write migration SQL** (AC: 2, 3)
  - [x] Create `src-tauri/migrations/001_initial.sql` with all six table definitions
  - [x] Ensure JSON columns (`headers`, `query_params`, `auth_config`, `variables`, `request_snapshot`) are typed as `TEXT NOT NULL DEFAULT '[]'` or `'{}'` as appropriate
  - [x] Ensure `is_active INTEGER NOT NULL DEFAULT 0` for environments (SQLite has no boolean)
  - [x] Include a `settings` table for future Story 4.3

- [x] **Task 3 — Wire plugin in Rust** (AC: 1, 4)
  - [x] Create `src-tauri/src/db.rs` — loads the migration file via `include_str!` and defines a `Vec<Migration>` returned by `pub fn migrations()`
  - [x] Update `src-tauri/src/lib.rs` — register `tauri_plugin_sql::Builder::default().add_migrations(...).build()` before `.run()`

- [x] **Task 4 — TypeScript `db.ts` wrapper** (AC: 5)
  - [x] Create `src/lib/db.ts` exporting all data model TypeScript interfaces
  - [x] Implement `getDb()` — async singleton that calls `Database.load('sqlite:dispatch.db')` once
  - [x] Export `DB_PATH` constant `'sqlite:dispatch.db'`

- [x] **Task 5 — Unit tests for `db.ts`** (AC: 7)
  - [x] Create `src/lib/db.test.ts`
  - [x] Mock `@tauri-apps/plugin-sql` with `vi.mock`
  - [x] Test: `getDb()` resolves successfully when the mock succeeds
  - [x] Test: `getDb()` called twice returns the same instance (singleton)
  - [x] Test: `getDb()` rejects and re-throws when `Database.load` throws
  - [x] Test: TypeScript interface shapes are structurally sound (compile-time via `tsc`)

- [x] **Task 6 — TypeScript validation** (AC: 6)
  - [x] Run `yarn typecheck` — zero errors

## Dev Notes

### Previous Story Learnings (Story 1.1)

- **Peer dep**: Always explicitly add `@testing-library/dom` as a devDep — `@testing-library/react` does not pull it in automatically with some lockfile versions.
- **Vitest config**: `vitest.config.ts` does NOT include the `tailwindcss()` Vite plugin — it uses a minimal config with `react()` only.
- **Path alias**: `@/` is configured in `vite.config.ts`, `tsconfig.app.json`, and `vitest.config.ts` — all three must agree.
- **Rust not installed**: All Rust files are authored correctly. AC#1 and AC#4 require `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` followed by `yarn tauri dev`. Every other AC is verifiable purely in TypeScript/Vitest.
- **Zustand stores are minimal**: Only add fields that the current story needs — story 1.3 will extend `requestStore.ts`.

### Tech Stack Versions

| Dep                           | Version                                           |
| ----------------------------- | ------------------------------------------------- |
| `tauri-plugin-sql` (Rust)     | `2.x` (matches Tauri `2.x`)                       |
| `@tauri-apps/plugin-sql` (JS) | `^2.x`                                            |
| SQLite feature flag           | `features = ["sqlite"]` in Cargo.toml — mandatory |

### `Cargo.toml` Addition

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Migration SQL — `src-tauri/migrations/001_initial.sql`

Full schema to author:

```sql
-- Collections
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Folders (nested within collections)
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Requests
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  url TEXT NOT NULL DEFAULT '',
  headers TEXT NOT NULL DEFAULT '[]',
  query_params TEXT NOT NULL DEFAULT '[]',
  body_type TEXT NOT NULL DEFAULT 'none',
  body_content TEXT NOT NULL DEFAULT '',
  auth_type TEXT NOT NULL DEFAULT 'none',
  auth_config TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Environments
CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- History (capped to 200 at application level)
CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  request_snapshot TEXT NOT NULL DEFAULT '{}',
  sent_at TEXT NOT NULL
);

-- Settings (key-value store for app preferences)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('theme', '"system"'),
  ('request_timeout_ms', '30000'),
  ('ssl_verify', 'true'),
  ('editor_font_size', '14');
```

### `src-tauri/src/db.rs`

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: include_str!("../../migrations/001_initial.sql"),
        kind: MigrationKind::Up,
    }]
}
```

### Updated `src-tauri/src/lib.rs`

```rust
mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:dispatch.db", db::migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Capabilities Update — `src-tauri/capabilities/default.json`

```json
{
  "permissions": [
    "core:default",
    "shell:allow-open",
    "sql:allow-execute",
    "sql:allow-load",
    "sql:allow-select"
  ]
}
```

### TypeScript Interfaces — `src/lib/db.ts`

All interfaces must mirror the spec data models exactly. JSON columns stored as TEXT in SQLite are parsed/serialised at the TypeScript layer.

```typescript
export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  collection_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Request {
  id: string;
  collection_id: string | null;
  folder_id: string | null;
  name: string;
  method: string;
  url: string;
  headers: KeyValuePair[];
  query_params: KeyValuePair[];
  body_type: 'none' | 'raw' | 'json' | 'form-data' | 'urlencoded';
  body_content: string;
  auth_type: 'none' | 'bearer' | 'basic' | 'api-key';
  auth_config: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
  is_active: boolean;
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  method: string;
  url: string;
  status_code: number;
  response_time_ms: number;
  request_snapshot: Request;
  sent_at: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  request_timeout_ms: number;
  ssl_verify: boolean;
  editor_font_size: number;
}
```

**Singleton pattern for `getDb()`:**

```typescript
import Database from '@tauri-apps/plugin-sql';

export const DB_PATH = 'sqlite:dispatch.db';

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db === null) {
    _db = await Database.load(DB_PATH);
  }
  return _db;
}
```

> ⚠️ **Reset singleton in tests**: because `_db` is module-level state, each test that exercises error paths must reset it. Either re-import fresh with `vi.resetModules()` or expose a `_resetDb()` helper (test-only).

### Mocking `@tauri-apps/plugin-sql` in Vitest

```typescript
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn(),
  },
}));
```

`Database.load` returns a `Promise<Database>`. The mock should resolve with a fake DB object or reject to test error handling.

### Scope Boundaries — DO NOT implement in this story

- CRUD helper functions (e.g. `getCollections()`, `saveRequest()`) — these belong in the feature stories that need them
- Any React component changes — this story is pure infrastructure
- History trimming logic (cap at 200) — Story 2.4
- Environment activation logic — Story 3.1

### File Paths to Create / Modify

| Action | Path                                   |
| ------ | -------------------------------------- |
| CREATE | `src-tauri/migrations/001_initial.sql` |
| CREATE | `src-tauri/src/db.rs`                  |
| MODIFY | `src-tauri/src/lib.rs`                 |
| MODIFY | `src-tauri/Cargo.toml`                 |
| MODIFY | `src-tauri/capabilities/default.json`  |
| CREATE | `src/lib/db.ts`                        |
| CREATE | `src/lib/db.test.ts`                   |

### References

- Data models: [api-client-spec.md](../../api-client-spec.md#data-models)
- Epic goals: [planning-artifacts/epic-1.md](../planning-artifacts/epic-1.md#story-12-sqlite-schema-and-migrations)
- tauri-plugin-sql v2 docs: https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/sql
- `@tauri-apps/plugin-sql` npm: https://www.npmjs.com/package/@tauri-apps/plugin-sql

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (GitHub Copilot)

### Debug Log References

_none_

### Completion Notes List

- ✅ `@tauri-apps/plugin-sql@2.3.2` added to JS deps
- ✅ `tauri-plugin-sql = { version = "2", features = ["sqlite"] }` added to `Cargo.toml`
- ✅ `sql:allow-execute`, `sql:allow-load`, `sql:allow-select` added to capabilities
- ✅ `001_initial.sql` creates all 6 tables: `collections`, `folders`, `requests`, `environments`, `history`, `settings` with seeded default settings
- ✅ `src-tauri/src/db.rs` embeds SQL via `include_str!` and returns `Vec<Migration>`
- ✅ `lib.rs` registers `tauri_plugin_sql::Builder` with migrations before `.run()`
- ✅ `src/lib/db.ts` exports all 7 interfaces + `getDb()` singleton + `DB_PATH`
- ✅ 7 new unit tests all pass (18 total across 3 files)
- ✅ `tsc --noEmit` — zero errors
- ⚠️ AC#1 and AC#4 (actual DB file creation / migration idempotency) require `yarn tauri dev` with Rust installed to verify at runtime

### File List

**New files:**
- `dispatch/src-tauri/migrations/001_initial.sql`
- `dispatch/src-tauri/src/db.rs`
- `dispatch/src/lib/db.ts`
- `dispatch/src/lib/db.test.ts`

**Modified files:**
- `dispatch/src-tauri/Cargo.toml` — added `tauri-plugin-sql`
- `dispatch/src-tauri/src/lib.rs` — registered SQL plugin with migrations
- `dispatch/src-tauri/capabilities/default.json` — added SQL permissions
- `dispatch/package.json` — added `@tauri-apps/plugin-sql@2.3.2`

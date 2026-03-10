# Story 4.2: Import/Export Collections and Environments

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Dispatch user,
I want to export my collections and environments to JSON files and import them back,
so that I can move my work between machines and share collections with teammates.

## Acceptance Criteria

1. **Export collection**: user selects a collection → Tauri file-save dialog opens → JSON file written to chosen path.
2. **Export environment**: user selects an environment → Tauri file-save dialog opens → JSON file written to chosen path.
3. **Import collection**: user clicks "Import Collection" → Tauri file-open dialog opens → JSON validated → collection, folders, and requests inserted into DB and store → summary shown (e.g. "Imported 'My API' — 2 folders, 5 requests").
4. **Import environment**: user clicks "Import Environment" → Tauri file-open dialog opens → JSON validated → environment inserted into DB and store → summary shown (e.g. "Imported environment 'Production' — 4 variables").
5. **Error handling**: malformed JSON, wrong `type` field, or missing required fields shows a user-readable inline error message; no partial writes occur.
6. **No ID conflicts on import**: all imported entities receive brand-new `crypto.randomUUID()` IDs; referential integrity between collection → folders → requests is preserved via a remapping step.

## Tasks / Subtasks

- [ ] Task 1 — Add Tauri plugin-dialog and plugin-fs dependencies (AC: 1, 2, 3, 4)
  - [ ] In `dispatch/package.json`, add `"@tauri-apps/plugin-dialog": "^2"` and `"@tauri-apps/plugin-fs": "^2"` to `dependencies`
  - [ ] In `dispatch/src-tauri/Cargo.toml`, add `tauri-plugin-dialog = "2"` and `tauri-plugin-fs = "2"` under `[dependencies]`
  - [ ] In `dispatch/src-tauri/src/lib.rs`, register both plugins:
    ```rust
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    ```
  - [ ] In `dispatch/src-tauri/capabilities/default.json`, add permissions:
    ```json
    "dialog:allow-save",
    "dialog:allow-open",
    "fs:allow-write-text-file",
    "fs:allow-read-text-file"
    ```
  - [ ] Run `yarn tauri dev` to verify compilation succeeds (Cargo resolves new crates)

- [ ] Task 2 — Create `lib/importExport.ts` (AC: 1–6)
  - [ ] Create `dispatch/src/lib/importExport.ts`
  - [ ] Define the export envelope interfaces:
    ```typescript
    export interface CollectionExport {
        dispatch_version: '1.0';
        type: 'collection';
        exported_at: string;
        collection: Collection;
        folders: Folder[];
        requests: Request[];
    }

    export interface EnvironmentExport {
        dispatch_version: '1.0';
        type: 'environment';
        exported_at: string;
        environment: Environment;
    }
    ```
  - [ ] Export `function exportCollectionToJson(collectionId: string, store: { collections: Collection[]; folders: Folder[]; requests: Request[] }): string`
    - Finds the collection, all its folders, all its requests by `collection_id`
    - Builds and returns `JSON.stringify(envelope, null, 2)` where `dispatch_version: '1.0'`, `type: 'collection'`, `exported_at: new Date().toISOString()`
    - Throws `Error('Collection not found')` if `collectionId` is not in store
  - [ ] Export `function exportEnvironmentToJson(environmentId: string, environments: Environment[]): string`
    - Finds the environment, builds and returns JSON envelope with `type: 'environment'`
    - Throws `Error('Environment not found')` if not found
  - [ ] Export `async function importCollectionFromJson(json: string): Promise<{ collection: Collection; folders: Folder[]; requests: Request[] }>`
    - `JSON.parse(json)` — wrap in try/catch, throw `Error('Invalid JSON')` if parse fails
    - Validate: `envelope.dispatch_version === '1.0'`, `envelope.type === 'collection'`, `envelope.collection` is an object, `envelope.collection.name` is a non-empty string — throw descriptive `Error` if any check fails
    - **ID remapping**: generate `newCollectionId = crypto.randomUUID()`; build `folderIdMap: Map<string, string>` keyed by old folder ID → new UUID for each folder in `envelope.folders`
    - Rebuild collection object with `newCollectionId`, `created_at: new Date().toISOString()`, `updated_at: new Date().toISOString()`
    - Rebuild each folder with new ID from `folderIdMap`, `collection_id: newCollectionId`, `parent_id` remapped through `folderIdMap` (if `parent_id` is not null and not in map, set to `null`)
    - Rebuild each request with `crypto.randomUUID()`, `collection_id: newCollectionId`, `folder_id` remapped through `folderIdMap` (null if not found)
    - Write to DB using `getDb()` directly via raw SQL (pattern mirrors `collections.ts`); write **collection first**, then **folders**, then **requests** — in a serial `await` chain (SQLite; no transaction API in plugin-sql v2)
    - Return `{ collection, folders, requests }` (all rebuilt objects with new IDs)
  - [ ] Export `async function importEnvironmentFromJson(json: string): Promise<Environment>`
    - Parse and validate: `dispatch_version === '1.0'`, `type === 'environment'`, `environment.name` is a non-empty string
    - Rebuild environment with `crypto.randomUUID()`, `is_active: false`, `created_at: new Date().toISOString()`
    - Insert into DB
    - Return rebuilt environment
  - [ ] **No partial writes**: all validation must pass before any DB call

- [ ] Task 3 — Wire export in `CollectionTree.tsx` (AC: 1)
  - [ ] Open `dispatch/src/components/CollectionTree/CollectionTree.tsx`
  - [ ] Add `import { save } from '@tauri-apps/plugin-dialog';` and `import { writeTextFile } from '@tauri-apps/plugin-fs';`
  - [ ] Add `import { exportCollectionToJson } from '@/lib/importExport';`
  - [ ] Add `import { Download } from 'lucide-react';` (download icon, already in lucide-react)
  - [ ] Add `handleExportCollection` async function:
    ```typescript
    const handleExportCollection = async (id: string, name: string) => {
        const store = useCollectionStore.getState();
        try {
            const json = exportCollectionToJson(id, store);
            const path = await save({
                defaultPath: `${name.replace(/[^a-z0-9]/gi, '_')}.dispatch.json`,
                filters: [{ name: 'Dispatch Collection', extensions: ['json'] }],
            });
            if (path) await writeTextFile(path, json);
        } catch (err) {
            window.alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    ```
  - [ ] Add `Download` icon button to the per-collection action group (alongside existing `FolderPlus`, `FilePlus`, `Pencil`, `Trash2`) — place it between `Pencil` and `Trash2`:
    ```tsx
    <button
        aria-label={`Export ${col.item.name}`}
        title="Export collection"
        onClick={(e) => { e.stopPropagation(); void handleExportCollection(col.item.id, col.item.name); }}
    >
        <Download size={12} />
    </button>
    ```
  - [ ] Add `handleImportCollection` async function and "Import" button in the collection tree header (the `<div>` that already hosts the `+` add-collection button):
    ```typescript
    const handleImportCollection = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'Dispatch Collection', extensions: ['json'] }],
            });
            if (!selected) return;
            const path = typeof selected === 'string' ? selected : selected[0];
            const text = await readTextFile(path);
            const { collection, folders, requests } = await importCollectionFromJson(text);
            store.addCollection(collection);
            for (const f of folders) store.addFolder(f);
            for (const r of requests) store.addRequest(r);
            window.alert(`Imported '${collection.name}' — ${folders.length} folder(s), ${requests.length} request(s).`);
        } catch (err) {
            window.alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    ```
  - [ ] Add `import { open } from '@tauri-apps/plugin-dialog';` and `import { readTextFile } from '@tauri-apps/plugin-fs';`
  - [ ] Add `import { importCollectionFromJson } from '@/lib/importExport';`
  - [ ] Add import button next to the existing `+` add-collection button in the header (use `Upload` from lucide-react)

- [ ] Task 4 — Wire export/import in `EnvironmentPanel.tsx` (AC: 2, 4)
  - [ ] Open `dispatch/src/components/EnvironmentPanel/EnvironmentPanel.tsx`
  - [ ] Add dialog, fs, and importExport imports (same as Task 3 but for environments)
  - [ ] Add `handleExportEnvironment(id: string, name: string)` — same pattern as collection export but calls `exportEnvironmentToJson`
  - [ ] Add export button (`Download` icon) next to each environment row's existing action buttons
  - [ ] Add `handleImportEnvironment()` — reads file, calls `importEnvironmentFromJson`, calls `storeAddEnvironment(env)`, shows alert summary: `"Imported environment '${env.name}' — ${env.variables.length} variable(s)."`
  - [ ] Add "Import Environment" button (Upload icon) in the environment panel header, alongside the existing "New Environment" button

- [ ] Task 5 — Tests for `lib/importExport.ts` (AC: 1–6)
  - [ ] Create `dispatch/src/lib/importExport.test.ts`
  - [ ] Mock `@/lib/db` — return a fake DB with `select`, `execute` stubbed (same mock pattern as `collections.test.ts` and `settings.test.ts`)
  - [ ] **exportCollectionToJson tests:**
    - Given a store with one collection, two folders, three requests: returns valid JSON with correct envelope fields
    - `type` is `'collection'`, `dispatch_version` is `'1.0'`
    - Throws if `collectionId` not found in store
  - [ ] **exportEnvironmentToJson tests:**
    - Given an environment array: returns valid JSON with correct envelope fields
    - `type` is `'environment'`, `dispatch_version` is `'1.0'`
    - Throws if environment not found
  - [ ] **importCollectionFromJson tests:**
    - Valid input (round-trip): parses correctly, returned objects have new UUIDs (different from originals)
    - `collection_id` on all folders and requests matches new collection ID
    - `folder_id` on requests is remapped from old to new folder IDs
    - DB `execute` is called (collection insert, folder inserts, request inserts)
    - Invalid JSON throws `Error('Invalid JSON')`
    - Wrong `type` field throws with descriptive message
    - Missing `collection.name` throws with descriptive message
    - Wrong `dispatch_version` throws with descriptive message
    - No DB calls made when validation fails (no partial writes)
  - [ ] **importEnvironmentFromJson tests:**
    - Valid input: returns environment with new UUID, `is_active: false`
    - Invalid JSON throws
    - Missing `environment.name` throws
    - No DB calls when validation fails

- [ ] Task 6 — Quality gates
  - [ ] Run `yarn typecheck` from `dispatch/` — no TypeScript errors
  - [ ] Run `yarn test` from `dispatch/` — all tests pass

- [ ] Final Task — Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 4.2

## Dev Notes

### Story Foundation

Story 4.2 is the second story in Epic 4 (Polish & Packaging). It is standalone and does not depend on Story 4.3 (Settings Panel) or 4.4 (App Packaging). The only prerequisite is Story 4.1 (Light/Dark Theme) which is complete.

**Story 4.3 dependency note**: Story 4.3 will move the TopBar theme toggle into the Settings Panel modal. This story does NOT touch the theme toggle button — leave it in place.

### New Tauri Plugins Required

This is the critical infrastructure task. Both `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` must be added before any UI can be implemented. These plugins are not yet in the project.

**npm side** (`dispatch/package.json`):
```json
"@tauri-apps/plugin-dialog": "^2",
"@tauri-apps/plugin-fs": "^2"
```

**Cargo side** (`src-tauri/Cargo.toml`):
```toml
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
```

**Rust registration** (`src-tauri/src/lib.rs`):
```rust
.plugin(tauri_plugin_dialog::init())
.plugin(tauri_plugin_fs::init())
```

**Capabilities** (`src-tauri/capabilities/default.json`) — add to the `"permissions"` array:
```json
"dialog:allow-save",
"dialog:allow-open",
"fs:allow-write-text-file",
"fs:allow-read-text-file"
```

**JS API usage** (Tauri v2, exact import paths):
```typescript
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
```

`save()` returns `string | null` (null if user cancels).
`open({ multiple: false })` returns `string | string[] | null`. Always normalise: `typeof selected === 'string' ? selected : selected[0]`.

### Export JSON Format

The envelope wraps the raw DB entities. **Do not strip or transform field names** — export/import round-trips the raw objects.

```json
// Collection export
{
  "dispatch_version": "1.0",
  "type": "collection",
  "exported_at": "2026-03-10T12:00:00.000Z",
  "collection": { "id": "...", "name": "My API", "description": "", "created_at": "...", "updated_at": "..." },
  "folders": [ { "id": "...", "collection_id": "...", "parent_id": null, "name": "Auth", "sort_order": 0, "created_at": "...", "updated_at": "..." } ],
  "requests": [ { "id": "...", "collection_id": "...", "folder_id": "...", "name": "Login", ... } ]
}

// Environment export
{
  "dispatch_version": "1.0",
  "type": "environment",
  "exported_at": "2026-03-10T12:00:00.000Z",
  "environment": { "id": "...", "name": "Production", "variables": [...], "is_active": false, "created_at": "..." }
}
```

### Import ID Remapping (Critical — Avoid DB Conflicts)

When importing a collection, **all IDs must be replaced** to avoid conflicts with any existing data:

```typescript
const newCollectionId = crypto.randomUUID();

// Remap folder IDs
const folderIdMap = new Map<string, string>();
for (const f of envelope.folders) {
    folderIdMap.set(f.id, crypto.randomUUID());
}

// Rebuild collection
const collection: Collection = {
    ...envelope.collection,
    id: newCollectionId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

// Rebuild folders
const folders = envelope.folders.map((f) => ({
    ...f,
    id: folderIdMap.get(f.id)!,
    collection_id: newCollectionId,
    parent_id: f.parent_id ? (folderIdMap.get(f.parent_id) ?? null) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}));

// Rebuild requests
const requests = envelope.requests.map((r) => ({
    ...r,
    id: crypto.randomUUID(),
    collection_id: newCollectionId,
    folder_id: r.folder_id ? (folderIdMap.get(r.folder_id) ?? null) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}));
```

### DB Insert Pattern for Import

Use `getDb()` directly, same as `collections.ts`. The `plugin-sql` v2 does NOT expose a transaction API from JS — write collection first, then folders, then requests in serial awaits. If a request insert fails mid-way, the user will see a partial import, but this is an acceptable edge case for v1 (full transactional rollback would require a Tauri `invoke` command on the Rust side, which is out of scope).

For inserting a full request object (with all serialisable fields), reuse the established SQL pattern from `createFullSavedRequest` in `collections.ts`:
```typescript
await db.execute(
    `INSERT INTO requests
        (id, collection_id, folder_id, name, method, url, headers, query_params,
         body_type, body_content, auth_type, auth_config, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [r.id, r.collection_id, r.folder_id, r.name, r.method, r.url,
     JSON.stringify(r.headers), JSON.stringify(r.query_params),
     r.body_type, r.body_content, r.auth_type, JSON.stringify(r.auth_config),
     r.sort_order, r.created_at, r.updated_at],
);
```

For environment import, `is_active` must be forced to `0` in the DB insert regardless of what the exported file says.

### Validation Rules (AC: 5)

Validate **before** any DB call. Throw a descriptive `Error` for each case:

| Check | Error message |
|---|---|
| `JSON.parse` fails | `'Invalid JSON: cannot parse file'` |
| `envelope.dispatch_version !== '1.0'` | `'Unsupported format version: expected 1.0'` |
| `envelope.type !== 'collection'` (for collection import) | `'Wrong file type: expected collection, got <type>'` |
| `!envelope.collection` or `!envelope.collection.name` | `'Missing required field: collection.name'` |
| `!envelope.environment` or `!envelope.environment.name` | `'Missing required field: environment.name'` |

### UI Placement

**CollectionTree — per-collection row actions** (alongside `FolderPlus`, `FilePlus`, `Pencil`, `Trash2`):
- Add `Download` (export) between `Pencil` and `Trash2`
- Look at how `Pencil` and `Trash2` buttons are styled: `className="hidden group-hover:block text-app-muted hover:text-app-inverse"` — match this pattern exactly
- Export button only appears on the **collection row** level, not on folder or request rows

**CollectionTree — header** (where the `+` add button lives):
- Add `Upload` (import) icon button immediately before or after the existing `+` add-collection button
- Use `title="Import collection"` for tooltip

**EnvironmentPanel — per-environment row actions**:
- Look at how `Trash2` is already in each env row — add `Download` (export) alongside it
- Same hover-visible pattern as CollectionTree

**EnvironmentPanel — header**:
- The header already has the "New Environment" button area — add "Import Environment" button alongside it

### lucide-react Icons

Both `Download` and `Upload` are available in `lucide-react` (already installed). Do NOT install any new UI libraries.

### Testing Pattern

Follow `collections.test.ts` and `settings.test.ts` for mock setup:

```typescript
// Mock @/lib/db
vi.mock('@/lib/db', () => ({
    getDb: vi.fn(),
}));

const mockExecute = vi.fn().mockResolvedValue(undefined);
const mockSelect = vi.fn();
const mockDb = { execute: mockExecute, select: mockSelect };

beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue(mockDb as unknown as Database);
    vi.clearAllMocks();
});
```

`exportCollectionToJson` and `exportEnvironmentToJson` are **pure functions** (no DB) — test them without mocking `getDb`.

For `importCollectionFromJson` and `importEnvironmentFromJson` — verify:
1. Returned objects have IDs different from the input envelope IDs
2. `mockExecute` was called the expected number of times (1 collection + N folders + M requests)
3. First `mockExecute` call includes the new collection ID

### Project Structure Notes

**New files:**
- `dispatch/src/lib/importExport.ts`
- `dispatch/src/lib/importExport.test.ts`

**Modified files:**
- `dispatch/package.json` (add two `@tauri-apps` deps)
- `dispatch/src-tauri/Cargo.toml` (add two `tauri-plugin-*` deps)
- `dispatch/src-tauri/src/lib.rs` (register two plugins)
- `dispatch/src-tauri/capabilities/default.json` (add four permissions)
- `dispatch/src/components/CollectionTree/CollectionTree.tsx` (export + import handlers + buttons)
- `dispatch/src/components/EnvironmentPanel/EnvironmentPanel.tsx` (export + import handlers + buttons)

**Do NOT create** a separate `ImportExportPanel` component — add the buttons inline to existing components.

### References

- `Collection`, `Folder`, `Request`, `Environment` interfaces: [src/lib/db.ts](dispatch/src/lib/db.ts)
- DB insert patterns: [src/lib/collections.ts](dispatch/src/lib/collections.ts) — `createFullSavedRequest`, `createCollection`, `createFolder`
- Environment DB patterns: [src/lib/environments.ts](dispatch/src/lib/environments.ts) — `createEnvironment`
- Existing collection store (Immer): [src/stores/collectionStore.ts](dispatch/src/stores/collectionStore.ts) — `addCollection`, `addFolder`, `addRequest`
- Existing environment store: [src/stores/environmentStore.ts](dispatch/src/stores/environmentStore.ts) — `addEnvironment`
- CollectionTree component: [src/components/CollectionTree/CollectionTree.tsx](dispatch/src/components/CollectionTree/CollectionTree.tsx)
- EnvironmentPanel component: [src/components/EnvironmentPanel/EnvironmentPanel.tsx](dispatch/src/components/EnvironmentPanel/EnvironmentPanel.tsx)
- Tauri capabilities: [src-tauri/capabilities/default.json](dispatch/src-tauri/capabilities/default.json)
- Tauri Cargo deps: [src-tauri/Cargo.toml](dispatch/src-tauri/Cargo.toml)
- Previous story pattern (Tauri plugin registration): [src-tauri/src/lib.rs](dispatch/src-tauri/src/lib.rs)
- Test mock pattern: [src/lib/collections.test.ts](dispatch/src/lib/collections.test.ts)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

### File List

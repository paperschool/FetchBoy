import type { Collection, Environment, Folder, KeyValuePair, Request } from '@/lib/db';
import { getDb } from '@/lib/db';
import { insertOne, insertMany } from '@/lib/dbHelpers';
import { updateEnvironmentVariables } from '@/lib/environments';
import { type ScriptTemplate, loadScriptTemplates, createScriptTemplate } from '@/lib/scriptTemplates';
import type { ImportWarning } from '@/lib/importers/types';
import { findCollectionByExactName, mergeEnvVariables, nextSortOrderBase } from '@/lib/importers/mergeCollection';
import { REQUEST_COLS, requestRow } from '@/lib/requestRow';

/** Existing store snapshot the importer consults to decide create-vs-merge (Story 21.2). */
export interface ImportSnapshot {
    collections: Collection[];
    folders: Folder[];
    requests: Request[];
    environments: Environment[];
}

/** Outcome of a native collection import — distinguishes a fresh create from a same-name merge. */
export interface ImportCollectionResult {
    mode: 'create' | 'merge';
    collection: Collection;
    folders: Folder[];
    requests: Request[];
    environment: Environment | null;
    warnings: ImportWarning[];
}

// ─── Export Envelope Interfaces ───────────────────────────────────────────────

export interface CollectionExport {
    fetch_boy_version: '1.0' | '1.1';
    type: 'collection';
    exported_at: string;
    collection: Collection;
    folders: Folder[];
    requests: Request[];
    /** Legacy 1.0 single-environment shape — still read on import for back-compat. */
    environment?: {
        variables: KeyValuePair[];
    };
    /** 1.1 — full named environments referenced by the collection. */
    environments?: { name: string; variables: KeyValuePair[] }[];
    /** 1.1 — script templates referenced by requests' pre_request_template_id. */
    templates?: ScriptTemplate[];
}

export interface EnvironmentExport {
    fetch_boy_version: '1.0';
    type: 'environment';
    exported_at: string;
    environment: Environment;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SECRET_PLACEHOLDER = '<REDACTED>';

function redactSecrets(variables: KeyValuePair[]): KeyValuePair[] {
    return variables.map((v) =>
        v.secret ? { ...v, value: SECRET_PLACEHOLDER } : v,
    );
}

/**
 * On import, blank any value that was redacted on export so the user re-enters it.
 * Gated on the `secret` flag (which the export preserves) so a legitimate non-secret
 * value that happens to equal the placeholder isn't wiped.
 */
function blankRedacted(variables: KeyValuePair[]): KeyValuePair[] {
    return variables.map((v) => (v.secret && v.value === SECRET_PLACEHOLDER ? { ...v, value: '' } : v));
}

/**
 * Normalise a 1.0 (`environment.variables`) or 1.1 (`environments[]`) envelope to
 * the 1.1 shape, blanking any redacted secret values.
 */
function normalizeIncomingEnvs(envelope: CollectionExport): { name: string; variables: KeyValuePair[] }[] {
    const raw = envelope.environments
        ?? (envelope.environment?.variables?.length
            ? [{ name: `${envelope.collection.name} Variables`, variables: envelope.environment.variables }]
            : []);
    return raw
        .filter((e) => e.variables.length > 0)
        .map((e) => ({ name: e.name, variables: blankRedacted(e.variables) }));
}

/**
 * Restore embedded script templates: reuse an existing same-named template, else
 * create it. Returns a map from the export's template id → the resolved local id.
 */
async function restoreTemplates(templates: ScriptTemplate[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (templates.length === 0) return map;
    const existing = await loadScriptTemplates();
    for (const t of templates) {
        const match = existing.find((e) => e.name === t.name);
        if (match) {
            map.set(t.id, match.id);
        } else {
            const created = await createScriptTemplate(t.name, t.code, t.description);
            map.set(t.id, created.id);
        }
    }
    return map;
}

/** Remap a request's linked-template id through the restore map (keep original on miss). */
function remapTemplateId(id: string | null | undefined, map: Map<string, string>): string | null {
    if (!id) return null;
    return map.get(id) ?? id;
}

// ─── Export Functions (pure — no DB) ─────────────────────────────────────────

export function exportCollectionToJson(
    collectionId: string,
    store: { collections: Collection[]; folders: Folder[]; requests: Request[] },
    environments: Environment[],
    opts: { includeSecrets?: boolean; templates?: ScriptTemplate[] } = {},
): string {
    const collection = store.collections.find((c) => c.id === collectionId);
    if (!collection) throw new Error('Collection not found');

    const folders = store.folders.filter((f) => f.collection_id === collectionId);
    const requests = store.requests.filter((r) => r.collection_id === collectionId);

    const maybeRedact = (vars: KeyValuePair[]): KeyValuePair[] =>
        opts.includeSecrets ? vars : redactSecrets(vars);

    const envelope: CollectionExport = {
        fetch_boy_version: '1.1',
        type: 'collection',
        exported_at: new Date().toISOString(),
        collection, // full Collection → carries pre_request_script (collection-wide script)
        folders,
        requests, // full Request[] → carries post_response_script + pre_request_template_id
    };

    // Full named environments referenced by the collection (today: the default).
    const referencedEnvIds = new Set<string>();
    if (collection.default_environment_id) referencedEnvIds.add(collection.default_environment_id);
    const exportedEnvs = [...referencedEnvIds]
        .map((id) => environments.find((e) => e.id === id))
        .filter((e): e is Environment => !!e && e.variables.length > 0)
        .map((e) => ({ name: e.name, variables: maybeRedact(e.variables) }));
    if (exportedEnvs.length > 0) envelope.environments = exportedEnvs;

    // Embed templates referenced by any request's pre_request_template_id.
    const referencedTemplateIds = new Set(
        requests.map((r) => r.pre_request_template_id).filter((id): id is string => !!id),
    );
    const exportedTemplates = (opts.templates ?? []).filter((t) => referencedTemplateIds.has(t.id));
    if (exportedTemplates.length > 0) envelope.templates = exportedTemplates;

    return JSON.stringify(envelope, null, 2);
}

export function exportEnvironmentToJson(environmentId: string, environments: Environment[]): string {
    const environment = environments.find((e) => e.id === environmentId);
    if (!environment) throw new Error('Environment not found');

    const envelope: EnvironmentExport = {
        fetch_boy_version: '1.0',
        type: 'environment',
        exported_at: new Date().toISOString(),
        environment: {
            ...environment,
            variables: redactSecrets(environment.variables),
        },
    };

    return JSON.stringify(envelope, null, 2);
}

// ─── Import Functions ─────────────────────────────────────────────────────────

export async function importCollectionFromJson(
    json: string,
    existing?: ImportSnapshot,
): Promise<ImportCollectionResult> {
    // Parse
    let envelope: CollectionExport;
    try {
        envelope = JSON.parse(json) as CollectionExport;
    } catch {
        throw new Error('Invalid JSON: cannot parse file');
    }

    // Validate — accept 1.0 (legacy) and 1.1 (Story 21.3).
    if (envelope.fetch_boy_version !== '1.0' && envelope.fetch_boy_version !== '1.1') {
        throw new Error('Unsupported format version: expected 1.0 or 1.1');
    }
    if (envelope.type !== 'collection') {
        throw new Error(`Wrong file type: expected collection, got ${String(envelope.type)}`);
    }
    if (!envelope.collection || !envelope.collection.name) {
        throw new Error('Missing required field: collection.name');
    }

    const now = new Date().toISOString();

    // Restore embedded templates (dedupe by name) and remap request links (Story 21.3).
    const templateIdMap = await restoreTemplates(envelope.templates ?? []);
    // Normalise environments to the 1.1 shape and blank any redacted secret values.
    const incomingEnvs = normalizeIncomingEnvs(envelope);

    // Story 21.2 — if a collection with this exact name already exists, merge into it.
    const target = existing
        ? findCollectionByExactName(envelope.collection.name, existing.collections)
        : undefined;
    if (existing && target) {
        return mergeIntoExisting(envelope, target, existing, now, templateIdMap, incomingEnvs);
    }

    // Remap IDs
    const newCollectionId = crypto.randomUUID();

    const folderIdMap = new Map<string, string>();
    for (const f of envelope.folders) {
        folderIdMap.set(f.id, crypto.randomUUID());
    }

    // Create the collection's environment(s) from embedded vars. The first becomes
    // the default; all are owned by the new collection.
    const createdEnvs: Environment[] = incomingEnvs.map((e) => ({
        id: crypto.randomUUID(),
        name: e.name,
        variables: e.variables,
        is_active: false,
        created_at: now,
        owner_collection_id: newCollectionId,
    }));
    const environment: Environment | null = createdEnvs[0] ?? null;

    const collection: Collection = {
        ...envelope.collection,
        id: newCollectionId,
        default_environment_id: environment?.id ?? null,
        created_at: now,
        updated_at: now,
    };

    const folders: Folder[] = envelope.folders.map((f) => ({
        ...f,
        id: folderIdMap.get(f.id)!,
        collection_id: newCollectionId,
        parent_id: f.parent_id ? (folderIdMap.get(f.parent_id) ?? null) : null,
        created_at: now,
        updated_at: now,
    }));

    const requests: Request[] = envelope.requests.map((r) => ({
        ...r,
        id: crypto.randomUUID(),
        collection_id: newCollectionId,
        folder_id: r.folder_id ? (folderIdMap.get(r.folder_id) ?? null) : null,
        pre_request_chain_id: null, // pre-request chains are retired — never re-import them
        pre_request_template_id: remapTemplateId(r.pre_request_template_id, templateIdMap),
        created_at: now,
        updated_at: now,
    }));

    // Write order matters: insert the collection FIRST (default env null) so the
    // environments' owner_collection_id FK has a target, then the environments, then
    // bind the default. (The previous env-first order violated the FK on fresh DBs.)
    const db = await getDb();
    await insertOne('collections',
        ['id', 'name', 'description', 'default_environment_id', 'pre_request_script', 'pre_request_script_enabled', 'created_at', 'updated_at'],
        [collection.id, collection.name, collection.description, null,
         collection.pre_request_script ?? '',
         (collection.pre_request_script_enabled ?? !!collection.pre_request_script?.trim()) ? 1 : 0,
         collection.created_at, collection.updated_at]);

    for (const env of createdEnvs) {
        await insertOne('environments', ['id', 'name', 'variables', 'is_active', 'created_at', 'owner_collection_id'],
            [env.id, env.name, JSON.stringify(env.variables), 0, env.created_at, env.owner_collection_id ?? null]);
    }

    if (collection.default_environment_id) {
        await db.execute('UPDATE collections SET default_environment_id = ? WHERE id = ?',
            [collection.default_environment_id, collection.id]);
    }

    const folderFields = ['id', 'collection_id', 'parent_id', 'name', 'sort_order', 'created_at', 'updated_at'] as const;
    await insertMany('folders', [...folderFields],
        folders.map((f) => [f.id, f.collection_id, f.parent_id, f.name, f.sort_order, f.created_at, f.updated_at]));

    await insertMany('requests', [...REQUEST_COLS], requests.map(requestRow));

    return { mode: 'create', collection, folders, requests, environment, warnings: [] };
}

/**
 * Merge an imported collection into an existing same-named one (Story 21.2).
 * Purely additive: appends folders/requests under the existing id (sort_order
 * continued) and merges env variables into the existing bound environment with
 * existing-value bias + per-conflict warnings. Never mutates pre-existing rows.
 */
async function mergeIntoExisting(
    envelope: CollectionExport,
    target: Collection,
    existing: ImportSnapshot,
    now: string,
    templateIdMap: Map<string, string>,
    incomingEnvs: { name: string; variables: KeyValuePair[] }[],
): Promise<ImportCollectionResult> {
    const targetId = target.id;

    // Fresh ids for appended folders so they never collide with the existing tree.
    const folderIdMap = new Map<string, string>();
    for (const f of envelope.folders) folderIdMap.set(f.id, crypto.randomUUID());

    const folderBase = nextSortOrderBase(existing.folders.filter((f) => f.collection_id === targetId));
    const requestBase = nextSortOrderBase(existing.requests.filter((r) => r.collection_id === targetId));

    const folders: Folder[] = envelope.folders.map((f, i) => ({
        ...f,
        id: folderIdMap.get(f.id)!,
        collection_id: targetId,
        parent_id: f.parent_id ? (folderIdMap.get(f.parent_id) ?? null) : null,
        sort_order: folderBase + i,
        created_at: now,
        updated_at: now,
    }));

    const requests: Request[] = envelope.requests.map((r, i) => ({
        ...r,
        id: crypto.randomUUID(),
        collection_id: targetId,
        folder_id: r.folder_id ? (folderIdMap.get(r.folder_id) ?? null) : null,
        pre_request_chain_id: null, // pre-request chains are retired — never re-import them
        pre_request_template_id: remapTemplateId(r.pre_request_template_id, templateIdMap),
        sort_order: requestBase + i,
        created_at: now,
        updated_at: now,
    }));

    const db = await getDb();

    // 1. Append folders + requests FIRST — purely additive, existing rows untouched.
    if (folders.length > 0) {
        const folderFields = ['id', 'collection_id', 'parent_id', 'name', 'sort_order', 'created_at', 'updated_at'] as const;
        await insertMany('folders', [...folderFields],
            folders.map((f) => [f.id, f.collection_id, f.parent_id, f.name, f.sort_order, f.created_at, f.updated_at]));
    }
    if (requests.length > 0) {
        await insertMany('requests', [...REQUEST_COLS], requests.map(requestRow));
    }

    // 2. Overwrite the collection-wide pre-request script with the imported one so a
    //    re-import restores it (Story 21.3 round-trip). Runs after the additive inserts.
    const importedScript = envelope.collection.pre_request_script ?? '';
    const importedScriptEnabled = envelope.collection.pre_request_script_enabled ?? !!importedScript.trim();
    await db.execute('UPDATE collections SET pre_request_script = ?, pre_request_script_enabled = ?, updated_at = ? WHERE id = ?',
        [importedScript, importedScriptEnabled ? 1 : 0, now, targetId]);

    // 3. Merge env variables LAST: this overwrites a pre-existing environment row, so
    //    do it only after the additive content succeeded — a failure here then can't
    //    strand the collection with mutated env vars but none of the imported content.
    const incomingVars = incomingEnvs.flatMap((e) => e.variables);
    let environment: Environment | null = null;
    const warnings: ImportWarning[] = [];
    let boundEnvId = target.default_environment_id;

    if (incomingVars.length > 0) {
        const targetEnv = target.default_environment_id
            ? existing.environments.find((e) => e.id === target.default_environment_id) ?? null
            : null;
        if (targetEnv) {
            const merged = mergeEnvVariables(targetEnv.variables, incomingVars);
            warnings.push(...merged.warnings);
            await updateEnvironmentVariables(targetEnv.id, merged.variables);
            environment = { ...targetEnv, variables: merged.variables };
        } else {
            // Target has no resolvable env — create one owned by the target and bind it.
            environment = {
                id: crypto.randomUUID(),
                name: `${target.name} Variables`,
                variables: incomingVars,
                is_active: false,
                created_at: now,
                owner_collection_id: targetId,
            };
            await insertOne('environments', ['id', 'name', 'variables', 'is_active', 'created_at', 'owner_collection_id'],
                [environment.id, environment.name, JSON.stringify(environment.variables), 0, environment.created_at, targetId]);
            await db.execute('UPDATE collections SET default_environment_id = ?, updated_at = ? WHERE id = ?',
                [environment.id, now, targetId]);
            boundEnvId = environment.id;
        }
    }

    return {
        mode: 'merge',
        collection: {
            ...target,
            pre_request_script: importedScript,
            pre_request_script_enabled: importedScriptEnabled,
            default_environment_id: boundEnvId,
        },
        folders,
        requests,
        environment,
        warnings,
    };
}

export async function importEnvironmentFromJson(json: string): Promise<Environment> {
    // Parse
    let envelope: EnvironmentExport;
    try {
        envelope = JSON.parse(json) as EnvironmentExport;
    } catch {
        throw new Error('Invalid JSON: cannot parse file');
    }

    // Validate
    if (envelope.fetch_boy_version !== '1.0') {
        throw new Error('Unsupported format version: expected 1.0');
    }
    if (envelope.type !== 'environment') {
        throw new Error(`Wrong file type: expected environment, got ${String(envelope.type)}`);
    }
    if (!envelope.environment || !envelope.environment.name) {
        throw new Error('Missing required field: environment.name');
    }

    const environment: Environment = {
        ...envelope.environment,
        id: crypto.randomUUID(),
        is_active: false,
        created_at: new Date().toISOString(),
    };

    await insertOne('environments', ['id', 'name', 'variables', 'is_active', 'created_at'],
        [environment.id, environment.name, JSON.stringify(environment.variables), 0, environment.created_at]);

    return environment;
}

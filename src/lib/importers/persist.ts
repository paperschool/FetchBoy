import type { Collection, Environment, Folder, Request } from '@/lib/db';
import { getDb } from '@/lib/db';
import { insertMany } from '@/lib/dbHelpers';
import { updateEnvironmentVariables } from '@/lib/environments';
import type { ImportSnapshot } from '@/lib/importExport';
import { findCollectionByExactName, mergeEnvVariables, nextSortOrderBase } from './mergeCollection';
import { REQUEST_COLS, requestRow } from '@/lib/requestRow';
import type { ImportResult, ImportWarning } from './types';

export interface PersistImportOutcome {
  mode: 'create' | 'merge';
  collection: Collection;
  folders: Folder[];
  requests: Request[];
  environments: Environment[];
  warnings: ImportWarning[];
}

/**
 * Persist an ImportResult to SQLite, sequentially in FK-dependency order
 * (environments → collection → folders → requests).
 *
 * NOTE: not wrapped in a SAVEPOINT/transaction. tauri-plugin-sql runs each
 * `db.execute` against a pooled connection, so multi-statement savepoints are
 * unreliable ("no such savepoint" when RELEASE lands on a different connection
 * than SAVEPOINT). Each insert below is individually atomic, which is enough
 * once `insertMany` chunks under the bound-parameter limit.
 */
const FOLDER_COLS = ['id', 'collection_id', 'parent_id', 'name', 'sort_order', 'created_at', 'updated_at'];
const folderRow = (f: Folder): unknown[] => [f.id, f.collection_id, f.parent_id, f.name, f.sort_order, f.created_at, f.updated_at];

export async function persistImportResult(
  result: ImportResult,
  existing?: ImportSnapshot,
): Promise<PersistImportOutcome> {
  const now = new Date().toISOString();
  const db = await getDb();

  // Story 21.2 — merge into an existing same-named collection instead of duplicating.
  const target = existing
    ? findCollectionByExactName(result.collection.name, existing.collections)
    : undefined;
  if (existing && target) {
    return mergeImportResult(result, target, existing, now);
  }

  const environments: Environment[] = result.environments.map((e) => ({
    id: crypto.randomUUID(),
    name: e.name,
    variables: e.variables,
    is_active: false,
    created_at: now,
    owner_collection_id: result.collection.id,
  }));

  const defaultEnvId = environments.length > 0 ? environments[0].id : null;

  const collection: Collection = {
    ...result.collection,
    description: result.collection.description ?? '',
    default_environment_id: defaultEnvId,
    created_at: now,
    updated_at: now,
  };
  const folders: Folder[] = result.folders.map((f) => ({ ...f, created_at: now, updated_at: now }));
  const requests: Request[] = result.requests.map((r) => ({ ...r, created_at: now, updated_at: now }));

  // Insert the collection FIRST (default env null) so the environments'
  // owner_collection_id FK has a target, then the environments, then bind the
  // default. (Env-first would violate the FK on a fresh foreign-keys-on DB.)
  await db.execute(
    'INSERT INTO collections (id, name, description, default_environment_id, pre_request_script, pre_request_script_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      collection.id, collection.name, collection.description, null,
      collection.pre_request_script ?? '',
      (collection.pre_request_script_enabled ?? !!collection.pre_request_script?.trim()) ? 1 : 0,
      collection.created_at, collection.updated_at,
    ],
  );

  await insertMany('environments', ['id', 'name', 'variables', 'is_active', 'created_at', 'owner_collection_id'],
    environments.map((env) => [env.id, env.name, JSON.stringify(env.variables), 0, env.created_at, env.owner_collection_id ?? null]));

  if (defaultEnvId) {
    await db.execute('UPDATE collections SET default_environment_id = ? WHERE id = ?', [defaultEnvId, collection.id]);
  }

  await insertMany('folders', FOLDER_COLS, folders.map(folderRow));
  await insertMany('requests', [...REQUEST_COLS], requests.map(requestRow));

  return { mode: 'create', collection, folders, requests, environments, warnings: [] };
}

/**
 * Merge a parsed import into an existing same-named collection (Story 21.2).
 * Additive: appends folders/requests (sort_order continued) and unions env
 * variables into the existing bound environment with existing-value bias.
 */
async function mergeImportResult(
  result: ImportResult,
  target: Collection,
  existing: ImportSnapshot,
  now: string,
): Promise<PersistImportOutcome> {
  const targetId = target.id;
  const folderBase = nextSortOrderBase(existing.folders.filter((f) => f.collection_id === targetId));
  const requestBase = nextSortOrderBase(existing.requests.filter((r) => r.collection_id === targetId));

  const folders: Folder[] = result.folders.map((f, i) => ({
    ...f, collection_id: targetId, sort_order: folderBase + i, created_at: now, updated_at: now,
  }));
  const requests: Request[] = result.requests.map((r, i) => ({
    ...r, collection_id: targetId, sort_order: requestBase + i, created_at: now, updated_at: now,
  }));

  const db = await getDb();

  // 1. Append folders + requests first (purely additive — existing rows untouched).
  if (folders.length > 0) await insertMany('folders', FOLDER_COLS, folders.map(folderRow));
  if (requests.length > 0) await insertMany('requests', [...REQUEST_COLS], requests.map(requestRow));

  // 2. Apply the imported collection-wide pre-request script only when the source
  //    actually carries one (most wizard formats don't), so an empty parse never
  //    clobbers an existing collection script.
  const incomingScript = result.collection.pre_request_script?.trim() ? result.collection.pre_request_script : '';
  if (incomingScript) {
    await db.execute('UPDATE collections SET pre_request_script = ?, pre_request_script_enabled = ?, updated_at = ? WHERE id = ?',
      [incomingScript, (result.collection.pre_request_script_enabled ?? true) ? 1 : 0, now, targetId]);
  }

  // 3. Merge env variables LAST (this overwrites a pre-existing env row).
  const incomingVars = result.environments.flatMap((e) => e.variables);
  const warnings: ImportWarning[] = [];
  const environments: Environment[] = [];
  if (incomingVars.length > 0) {
    const targetEnv = target.default_environment_id
      ? existing.environments.find((e) => e.id === target.default_environment_id) ?? null
      : null;
    if (targetEnv) {
      const m = mergeEnvVariables(targetEnv.variables, incomingVars);
      warnings.push(...m.warnings);
      await updateEnvironmentVariables(targetEnv.id, m.variables);
      environments.push({ ...targetEnv, variables: m.variables });
    } else {
      const env: Environment = {
        id: crypto.randomUUID(), name: `${target.name} Variables`, variables: incomingVars,
        is_active: false, created_at: now, owner_collection_id: targetId,
      };
      await insertMany('environments', ['id', 'name', 'variables', 'is_active', 'created_at', 'owner_collection_id'],
        [[env.id, env.name, JSON.stringify(env.variables), 0, env.created_at, targetId]]);
      await db.execute('UPDATE collections SET default_environment_id = ?, updated_at = ? WHERE id = ?', [env.id, now, targetId]);
      environments.push(env);
    }
  }

  return {
    mode: 'merge',
    collection: {
      ...target,
      pre_request_script: incomingScript || target.pre_request_script,
      pre_request_script_enabled: incomingScript ? (result.collection.pre_request_script_enabled ?? true) : target.pre_request_script_enabled,
      default_environment_id: environments[0]?.id ?? target.default_environment_id,
    },
    folders,
    requests,
    environments,
    warnings,
  };
}

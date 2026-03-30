import type { Collection, Environment, Folder, Request } from '@/lib/db';
import { getDb } from '@/lib/db';
import { insertMany } from '@/lib/dbHelpers';
import type { ImportResult } from './types';

/** Persist an ImportResult to SQLite with sequential inserts. */
export async function persistImportResult(result: ImportResult): Promise<{
  collection: Collection;
  folders: Folder[];
  requests: Request[];
  environments: Environment[];
}> {
  const now = new Date().toISOString();
  const db = await getDb();

  const environments: Environment[] = result.environments.map((e) => ({
    id: crypto.randomUUID(),
    name: e.name,
    variables: e.variables,
    is_active: false,
    created_at: now,
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

  // Insert environments first (foreign key target).
  await insertMany('environments', ['id', 'name', 'variables', 'is_active', 'created_at'],
    environments.map((env) => [env.id, env.name, JSON.stringify(env.variables), 0, env.created_at]));

  await db.execute(
    'INSERT INTO collections (id, name, description, default_environment_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [collection.id, collection.name, collection.description, collection.default_environment_id, collection.created_at, collection.updated_at],
  );

  await insertMany('folders', ['id', 'collection_id', 'parent_id', 'name', 'sort_order', 'created_at', 'updated_at'],
    folders.map((f) => [f.id, f.collection_id, f.parent_id, f.name, f.sort_order, f.created_at, f.updated_at]));

  await insertMany('requests', [
    'id', 'collection_id', 'folder_id', 'name', 'method', 'url', 'headers', 'query_params',
    'body_type', 'body_content', 'auth_type', 'auth_config', 'pre_request_script',
    'pre_request_script_enabled', 'sort_order', 'created_at', 'updated_at',
  ], requests.map((r) => [
    r.id, r.collection_id, r.folder_id, r.name, r.method, r.url,
    JSON.stringify(r.headers), JSON.stringify(r.query_params),
    r.body_type, r.body_content, r.auth_type, JSON.stringify(r.auth_config),
    r.pre_request_script, r.pre_request_script_enabled ? 1 : 0,
    r.sort_order, r.created_at, r.updated_at,
  ]));

  return { collection, folders, requests, environments };
}

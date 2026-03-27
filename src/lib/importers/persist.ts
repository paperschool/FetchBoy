import type { Collection, Folder, Request } from '@/lib/db';
import { insertOne, withTransaction } from '@/lib/dbHelpers';
import type { ImportResult } from './types';

/** Persist an ImportResult to SQLite in a single transaction. */
export async function persistImportResult(result: ImportResult): Promise<{
  collection: Collection;
  folders: Folder[];
  requests: Request[];
}> {
  const now = new Date().toISOString();

  const collection: Collection = { ...result.collection, description: result.collection.description ?? '', created_at: now, updated_at: now };
  const folders: Folder[] = result.folders.map((f) => ({ ...f, created_at: now, updated_at: now }));
  const requests: Request[] = result.requests.map((r) => ({ ...r, created_at: now, updated_at: now }));

  await withTransaction(async () => {
    await insertOne('collections', ['id', 'name', 'description', 'created_at', 'updated_at'],
      [collection.id, collection.name, collection.description, collection.created_at, collection.updated_at]);

    for (const f of folders) {
      await insertOne('folders', ['id', 'collection_id', 'parent_id', 'name', 'sort_order', 'created_at', 'updated_at'],
        [f.id, f.collection_id, f.parent_id, f.name, f.sort_order, f.created_at, f.updated_at]);
    }

    for (const r of requests) {
      await insertOne('requests', [
        'id', 'collection_id', 'folder_id', 'name', 'method', 'url', 'headers', 'query_params',
        'body_type', 'body_content', 'auth_type', 'auth_config', 'sort_order', 'created_at', 'updated_at',
      ], [
        r.id, r.collection_id, r.folder_id, r.name, r.method, r.url,
        JSON.stringify(r.headers), JSON.stringify(r.query_params),
        r.body_type, r.body_content, r.auth_type, JSON.stringify(r.auth_config),
        r.sort_order, r.created_at, r.updated_at,
      ]);
    }
  });

  return { collection, folders, requests };
}

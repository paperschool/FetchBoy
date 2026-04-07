import { getDb } from '@/lib/db';
import { now, insertOne, buildUpdate } from '@/lib/dbHelpers';
import type { StitchFolder, RawStitchFolder } from '@/types/stitch';

// ─── Deserializer ──────────────────────────────────────────────────────────

function deserializeFolder(raw: RawStitchFolder): StitchFolder {
  return {
    id: raw.id,
    parentId: raw.parent_id ?? null,
    name: raw.name,
    sortOrder: raw.sort_order ?? 0,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// ─── Folder CRUD ───────────────────────────────────────────────────────────

export async function loadStitchFolders(): Promise<StitchFolder[]> {
  const db = await getDb();
  const rows = await db.select<RawStitchFolder[]>(
    'SELECT * FROM stitch_folders ORDER BY sort_order ASC',
  );
  return rows.map(deserializeFolder);
}

export async function createStitchFolder(
  name: string,
  parentId?: string | null,
): Promise<StitchFolder> {
  const folder: StitchFolder = {
    id: crypto.randomUUID(),
    parentId: parentId ?? null,
    name,
    sortOrder: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  await insertOne(
    'stitch_folders',
    ['id', 'parent_id', 'name', 'sort_order', 'created_at', 'updated_at'],
    [folder.id, folder.parentId, folder.name, folder.sortOrder, folder.createdAt, folder.updatedAt],
  );
  return folder;
}

export async function renameStitchFolder(id: string, name: string): Promise<void> {
  const update = buildUpdate('stitch_folders', id, { name });
  if (!update) return;
  const db = await getDb();
  await db.execute(update.sql, update.values);
}

export async function deleteStitchFolder(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM stitch_folders WHERE id = ?', [id]);
}

export async function updateStitchFolderOrder(id: string, sortOrder: number): Promise<void> {
  const update = buildUpdate('stitch_folders', id, { sort_order: sortOrder });
  if (!update) return;
  const db = await getDb();
  await db.execute(update.sql, update.values);
}

// ─── Chain-Folder Operations ───────────────────────────────────────────────

export async function updateChainFolder(chainId: string, folderId: string | null): Promise<void> {
  const update = buildUpdate('stitch_chains', chainId, { folder_id: folderId });
  if (!update) return;
  const db = await getDb();
  await db.execute(update.sql, update.values);
}

export async function updateChainOrder(chainId: string, sortOrder: number): Promise<void> {
  const update = buildUpdate('stitch_chains', chainId, { sort_order: sortOrder });
  if (!update) return;
  const db = await getDb();
  await db.execute(update.sql, update.values);
}

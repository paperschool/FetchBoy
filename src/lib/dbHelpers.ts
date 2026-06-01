import { invoke } from '@tauri-apps/api/core';
import { getDb } from '@/lib/db';

export const now = (): string => new Date().toISOString();

/** Safe JSON.parse with typed fallback — replaces unsafe `JSON.parse(x) as T`. */
export function parseJsonField<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Generic INSERT helper — avoids repeating db.execute boilerplate. */
export async function insertOne(
  table: string,
  fields: string[],
  values: unknown[],
): Promise<void> {
  const db = await getDb();
  const placeholders = fields.map(() => '?').join(', ');
  await db.execute(
    `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}

/** Batch INSERT helper — inserts multiple rows in a single statement. */
/**
 * SQLite caps bound parameters per statement (999 on system SQLite — e.g. macOS).
 * Stay well under it so large multi-row inserts (e.g. a big collection import)
 * don't silently fail.
 */
const MAX_BIND_PARAMS = 900;

export async function insertMany(
  table: string,
  fields: string[],
  rows: unknown[][],
): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  const rowPlaceholder = `(${fields.map(() => '?').join(', ')})`;
  // Chunk so chunkSize * fields.length stays under the bound-parameter ceiling.
  const chunkSize = Math.max(1, Math.floor(MAX_BIND_PARAMS / fields.length));
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => rowPlaceholder).join(', ');
    await db.execute(
      `INSERT INTO ${table} (${fields.join(', ')}) VALUES ${placeholders}`,
      chunk.flat(),
    );
  }
}

/**
 * Build a dynamic UPDATE statement from a changes map.
 * Returns null if no changes — caller should return early.
 * Auto-appends `updated_at = ?` with current timestamp.
 */
export function buildUpdate(
  table: string,
  id: string,
  changes: Record<string, unknown>,
  fieldMap?: Record<string, (v: unknown) => unknown>,
): { sql: string; values: unknown[] } | null {
  const parts: string[] = [];
  const values: unknown[] = [];

  for (const [field, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    parts.push(`${field} = ?`);
    const transform = fieldMap?.[field];
    values.push(transform ? transform(value) : value);
  }

  if (parts.length === 0) return null;

  parts.push('updated_at = ?');
  values.push(now());
  values.push(id);

  return {
    sql: `UPDATE ${table} SET ${parts.join(', ')} WHERE id = ?`,
    values,
  };
}

/** Generic proxy sync — invoke a Tauri command with mapped items. */
export async function syncToProxy<T>(
  commandName: string,
  paramName: string,
  items: T[],
  mapFn: (item: T) => unknown,
): Promise<void> {
  await invoke(commandName, {
    [paramName]: items.map(mapFn),
  }).catch(() => {});
}

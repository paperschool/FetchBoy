import { getDb } from '@/lib/db';
import { insertOne, buildUpdate, now } from '@/lib/dbHelpers';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
  created_at: string;
  updated_at: string;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function loadScriptTemplates(): Promise<ScriptTemplate[]> {
  const db = await getDb();
  return db.select<ScriptTemplate[]>('SELECT * FROM script_templates ORDER BY name ASC');
}

export async function createScriptTemplate(
  name: string,
  code: string,
  description = '',
): Promise<ScriptTemplate> {
  const id = crypto.randomUUID();
  const timestamp = now();
  await insertOne(
    'script_templates',
    ['id', 'name', 'description', 'code', 'created_at', 'updated_at'],
    [id, name, description, code, timestamp, timestamp],
  );
  return { id, name, description, code, created_at: timestamp, updated_at: timestamp };
}

export async function updateScriptTemplate(
  id: string,
  patch: Partial<Pick<ScriptTemplate, 'name' | 'description' | 'code'>>,
): Promise<void> {
  const update = buildUpdate('script_templates', id, patch);
  if (!update) return;
  const db = await getDb();
  await db.execute(update.sql, update.values);
}

export async function deleteScriptTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM script_templates WHERE id = ?', [id]);
}

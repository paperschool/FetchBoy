import { getDb } from '@/lib/db';
import type { Environment, KeyValuePair } from '@/lib/db';

const now = () => new Date().toISOString();

// ─── Internal raw DB type ─────────────────────────────────────────────────────

interface RawEnvironment {
    id: string;
    name: string;
    variables: string; // JSON TEXT
    is_active: number; // SQLite INTEGER 0 or 1
    created_at: string;
}

function deserializeEnvironment(raw: RawEnvironment): Environment {
    return {
        id: raw.id,
        name: raw.name,
        variables: JSON.parse(raw.variables) as KeyValuePair[],
        is_active: raw.is_active === 1,
        created_at: raw.created_at,
    };
}

// ─── CRUD Helpers ─────────────────────────────────────────────────────────────

export async function loadAllEnvironments(): Promise<Environment[]> {
    const db = await getDb();
    const rows = await db.select<RawEnvironment[]>(
        'SELECT * FROM environments ORDER BY created_at ASC',
    );
    return rows.map(deserializeEnvironment);
}

export async function createEnvironment(name: string): Promise<Environment> {
    const db = await getDb();
    const env: Environment = {
        id: crypto.randomUUID(),
        name,
        variables: [],
        is_active: false,
        created_at: now(),
    };
    await db.execute(
        'INSERT INTO environments (id, name, variables, is_active, created_at) VALUES (?, ?, ?, ?, ?)',
        [env.id, env.name, JSON.stringify(env.variables), 0, env.created_at],
    );
    return env;
}

export async function renameEnvironment(id: string, name: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE environments SET name = ? WHERE id = ?', [name, id]);
}

export async function deleteEnvironment(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM environments WHERE id = ?', [id]);
}

export async function updateEnvironmentVariables(
    id: string,
    variables: KeyValuePair[],
): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE environments SET variables = ? WHERE id = ?', [
        JSON.stringify(variables),
        id,
    ]);
}

export async function setActiveEnvironment(id: string | null): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE environments SET is_active = 0');
    if (id !== null) {
        await db.execute('UPDATE environments SET is_active = 1 WHERE id = ?', [id]);
    }
}

import { getDb } from '@/lib/db';
import type { IgnoreRule } from '@/lib/db';
import { now, insertOne, buildUpdate, syncToProxy } from '@/lib/dbHelpers';

interface RawIgnoreRule {
    id: string;
    name: string;
    url_pattern: string;
    match_type: string;
    enabled: number;
    created_at: string;
    updated_at: string;
}

const boolToInt = (v: unknown): number => (v ? 1 : 0);

function deserializeIgnoreRule(raw: RawIgnoreRule): IgnoreRule {
    return {
        ...raw,
        match_type: raw.match_type as IgnoreRule['match_type'],
        enabled: raw.enabled === 1,
    };
}

// ─── Load All ─────────────────────────────────────────────────────────────────

export async function loadAllIgnoreRules(): Promise<IgnoreRule[]> {
    const db = await getDb();
    const raw = await db.select<RawIgnoreRule[]>(
        'SELECT * FROM ignore_rules ORDER BY created_at ASC',
    );
    return raw.map(deserializeIgnoreRule);
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export async function createIgnoreRule(
    name: string,
    urlPattern: string,
    matchType: IgnoreRule['match_type'],
): Promise<IgnoreRule> {
    const id = crypto.randomUUID();
    const ts = now();
    await insertOne(
        'ignore_rules',
        ['id', 'name', 'url_pattern', 'match_type', 'enabled', 'created_at', 'updated_at'],
        [id, name, urlPattern, matchType, 1, ts, ts],
    );
    return {
        id, name, url_pattern: urlPattern, match_type: matchType,
        enabled: true, created_at: ts, updated_at: ts,
    };
}

export async function updateIgnoreRule(
    id: string,
    changes: Partial<Pick<IgnoreRule, 'name' | 'url_pattern' | 'match_type' | 'enabled'>>,
): Promise<void> {
    const update = buildUpdate('ignore_rules', id, changes, { enabled: boolToInt });
    if (!update) return;
    const db = await getDb();
    await db.execute(update.sql, update.values);
}

export async function deleteIgnoreRule(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM ignore_rules WHERE id = ?', [id]);
}

// ─── Proxy Sync ───────────────────────────────────────────────────────────────

export async function syncIgnoreRulesToProxy(rules: IgnoreRule[]): Promise<void> {
    await syncToProxy('sync_ignore_rules', 'ignoreRules', rules, (r) => ({
        id: r.id, url_pattern: r.url_pattern, match_type: r.match_type, enabled: r.enabled,
    }));
}

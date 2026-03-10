import { getDb, AppSettings } from '@/lib/db';

type SettingsRow = { key: string; value: string };

export async function loadAllSettings(): Promise<AppSettings> {
    try {
        const db = await getDb();
        const rows = await db.select<SettingsRow[]>('SELECT key, value FROM settings');
        const map = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value) as unknown]));
        return {
            theme: (map['theme'] as AppSettings['theme']) ?? 'system',
            request_timeout_ms: (map['request_timeout_ms'] as number) ?? 30000,
            ssl_verify: (map['ssl_verify'] as boolean) ?? true,
            editor_font_size: (map['editor_font_size'] as number) ?? 14,
        };
    } catch {
        return { theme: 'system', request_timeout_ms: 30000, ssl_verify: true, editor_font_size: 14 };
    }
}

export async function saveSetting(
    key: keyof AppSettings,
    value: AppSettings[keyof AppSettings],
): Promise<void> {
    const db = await getDb();
    await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        key,
        JSON.stringify(value),
    ]);
}

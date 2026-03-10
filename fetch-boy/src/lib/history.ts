import { getDb, type HistoryEntry, type Request } from '@/lib/db';

interface PersistHistoryInput {
    method: string;
    url: string;
    statusCode: number;
    responseTimeMs: number;
    requestSnapshot: Request;
}

interface RawHistoryEntry {
    id: string;
    method: string;
    url: string;
    status_code: number;
    response_time_ms: number;
    request_snapshot: string; // raw JSON text from SQLite
    sent_at: string;
}

export async function loadHistory(limit = 200): Promise<HistoryEntry[]> {
    const db = await getDb();
    const rows = await db.select<RawHistoryEntry[]>(
        'SELECT * FROM history ORDER BY sent_at DESC LIMIT ?',
        [limit],
    );
    return rows.map((row) => ({
        ...row,
        request_snapshot: JSON.parse(row.request_snapshot) as Request,
    }));
}

export async function clearHistory(): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM history');
}

export async function persistHistoryEntry(input: PersistHistoryInput): Promise<HistoryEntry> {
    const db = await getDb();

    const nowIso = new Date().toISOString();
    const historyEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        method: input.method,
        url: input.url,
        status_code: input.statusCode,
        response_time_ms: input.responseTimeMs,
        request_snapshot: input.requestSnapshot,
        sent_at: nowIso,
    };

    await db.execute(
        `INSERT INTO history (id, method, url, status_code, response_time_ms, request_snapshot, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            historyEntry.id,
            historyEntry.method,
            historyEntry.url,
            historyEntry.status_code,
            historyEntry.response_time_ms,
            JSON.stringify(historyEntry.request_snapshot),
            historyEntry.sent_at,
        ],
    );

    return historyEntry;
}

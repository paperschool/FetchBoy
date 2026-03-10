import { getDb, type HistoryEntry, type Request } from '@/lib/db';

interface PersistHistoryInput {
    method: string;
    url: string;
    statusCode: number;
    responseTimeMs: number;
    requestSnapshot: Request;
}

export async function persistHistoryEntry(input: PersistHistoryInput): Promise<void> {
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
}

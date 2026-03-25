import type { MappingLogEntry } from '@/stores/mappingLogStore';

export function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function filterLogEntries(
    entries: MappingLogEntry[],
    searchQuery: string,
): MappingLogEntry[] {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
        (e) =>
            e.url.toLowerCase().includes(q) ||
            e.mappingName.toLowerCase().includes(q) ||
            e.mappingId.toLowerCase().includes(q),
    );
}

export const OVERRIDE_ICONS: Record<string, { label: string; color: string }> = {
    headers_add: { label: 'H+', color: 'text-teal-400' },
    headers_remove: { label: 'H-', color: 'text-red-400' },
    cookies: { label: 'C', color: 'text-orange-400' },
    response_body: { label: 'B', color: 'text-purple-400' },
    url_remap: { label: 'R', color: 'text-blue-400' },
    paused: { label: 'P', color: 'text-amber-400' },
    status_code: { label: 'S', color: 'text-yellow-400' },
    blocked: { label: 'X', color: 'text-red-500' },
};

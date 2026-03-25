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

export const OVERRIDE_ICONS: Record<string, { label: string; tooltip: string; color: string }> = {
    headers_add: { label: 'H+', tooltip: 'Headers added', color: 'text-teal-400' },
    headers_remove: { label: 'H-', tooltip: 'Headers removed', color: 'text-red-400' },
    cookies: { label: 'C', tooltip: 'Cookies set', color: 'text-orange-400' },
    response_body: { label: 'B', tooltip: 'Response body overridden', color: 'text-purple-400' },
    url_remap: { label: 'R', tooltip: 'URL remapped', color: 'text-blue-400' },
    paused: { label: 'P', tooltip: 'Request paused (breakpoint)', color: 'text-amber-400' },
    status_code: { label: 'S', tooltip: 'Status code overridden', color: 'text-yellow-400' },
    blocked: { label: 'X', tooltip: 'Request blocked', color: 'text-red-500' },
};

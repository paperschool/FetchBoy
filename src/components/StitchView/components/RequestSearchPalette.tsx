import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useCollectionStore } from '@/stores/collectionStore';
import type { Request } from '@/lib/db';

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-600 text-white',
  POST: 'bg-blue-600 text-white',
  PUT: 'bg-orange-500 text-white',
  PATCH: 'bg-yellow-600 text-white',
  DELETE: 'bg-red-600 text-white',
  HEAD: 'bg-gray-500 text-white',
  OPTIONS: 'bg-gray-500 text-white',
};

interface RequestSearchPaletteProps {
  onSelect: (request: Request) => void;
  onClose: () => void;
}

export function RequestSearchPalette({ onSelect, onClose }: RequestSearchPaletteProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const collections = useCollectionStore((s) => s.collections);
  const folders = useCollectionStore((s) => s.folders);
  const requests = useCollectionStore((s) => s.requests);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Build searchable entries with path info
  const entries = useMemo(() => {
    return requests.map((r) => {
      const col = collections.find((c) => c.id === r.collection_id);
      const folder = folders.find((f) => f.id === r.folder_id);
      const path = [col?.name, folder?.name].filter(Boolean).join(' / ');
      const searchText = `${r.method} ${r.name} ${r.url} ${path}`.toLowerCase();
      return { request: r, path, searchText };
    });
  }, [requests, collections, folders]);

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter((e) => e.searchText.includes(q));
  }, [entries, query]);

  const handleSelect = useCallback((r: Request): void => {
    onSelect(r);
    onClose();
  }, [onSelect, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <div
      className="flex flex-col overflow-hidden rounded border border-app-subtle bg-app-main shadow-lg"
      onKeyDown={handleKeyDown}
      data-testid="request-search-palette"
    >
      {/* Search input */}
      <div className="flex items-center gap-2 border-b border-app-subtle px-3 py-2">
        <Search size={14} className="shrink-0 text-app-muted" />
        <input
          ref={inputRef}
          type="text"
          className="min-w-0 flex-1 bg-transparent text-sm text-app-primary outline-none placeholder:text-app-muted"
          placeholder="Search requests..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="request-search-input"
        />
        <button
          className="shrink-0 rounded p-0.5 text-app-muted hover:text-app-secondary"
          onClick={onClose}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Results */}
      <div className="max-h-[240px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-app-muted">
            {requests.length === 0 ? 'No saved requests' : 'No matches'}
          </div>
        ) : (
          filtered.map((entry) => (
            <button
              key={entry.request.id}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-blue-500/15"
              onClick={() => handleSelect(entry.request)}
              data-testid={`search-result-${entry.request.id}`}
            >
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${METHOD_COLORS[entry.request.method] ?? METHOD_COLORS.GET}`}>
                {entry.request.method}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-app-primary">{entry.request.name}</div>
                {entry.path && (
                  <div className="truncate text-[10px] text-app-muted">{entry.path}</div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

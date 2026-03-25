import { ListPlus, Cookie, FileCode, ArrowRight, Pencil, Trash2, Play, Pause, Route } from 'lucide-react';
import type { Mapping } from '@/lib/db';
import { useMappingsStore } from '@/stores/mappingsStore';

interface MappingRowProps {
    mapping: Mapping;
    onEdit: () => void;
    onDelete: () => void;
}

export function MappingRow({ mapping, onEdit, onDelete }: MappingRowProps) {
    const toggleEnabled = useMappingsStore((s) => s.toggleEnabled);

    return (
        <div data-testid={`mapping-${mapping.id}`} className="mb-0.5">
            <div
                onClick={onEdit}
                className="flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-pointer"
            >
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void toggleEnabled(mapping.id); }}
                    aria-label={mapping.enabled ? 'Disable mapping' : 'Enable mapping'}
                    title={mapping.enabled ? 'Disable' : 'Enable'}
                    className={`flex-shrink-0 p-1 rounded cursor-pointer transition-colors ${
                        mapping.enabled
                            ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                            : 'text-app-muted hover:text-app-secondary hover:bg-gray-600/40'
                    }`}
                >
                    {mapping.enabled ? <Pause size={11} /> : <Play size={11} />}
                </button>
                <Route size={12} className={`flex-shrink-0 ${mapping.enabled ? 'text-emerald-400' : 'text-app-muted'}`} />
                <span className="flex-1 text-app-secondary text-xs truncate">{mapping.name}</span>
                {(mapping.headers_add.some((h) => h.enabled) || mapping.headers_remove.some((h) => h.enabled)) && (
                    <span title="Header modifications" className="flex-shrink-0 text-teal-400" data-testid="headers-indicator">
                        <ListPlus size={10} />
                    </span>
                )}
                {mapping.cookies.length > 0 && (
                    <span title="Cookie overrides" className="flex-shrink-0 text-orange-400" data-testid="cookies-indicator">
                        <Cookie size={10} />
                    </span>
                )}
                {mapping.response_body_enabled && (
                    <span title="Response body override" className="flex-shrink-0 text-purple-400" data-testid="body-indicator">
                        <FileCode size={10} />
                    </span>
                )}
                {mapping.url_remap_enabled && (
                    <span title={`URL remap → ${mapping.url_remap_target}`} className="flex-shrink-0 text-blue-400" data-testid="remap-indicator">
                        <ArrowRight size={10} />
                    </span>
                )}
                <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        aria-label="Edit mapping"
                        title="Edit"
                        className="p-1 rounded text-app-muted hover:text-app-inverse cursor-pointer"
                    >
                        <Pencil size={12} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        aria-label="Delete mapping"
                        title="Delete"
                        className="p-1 rounded text-red-400 hover:text-red-300 cursor-pointer"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}

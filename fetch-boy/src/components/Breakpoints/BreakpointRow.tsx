import { Bug, ArrowLeftRight, Pencil, Trash2, Gauge, ListPlus } from 'lucide-react';
import type { Breakpoint } from '@/lib/db';

interface BreakpointRowProps {
    breakpoint: Breakpoint;
    onEdit: () => void;
    onDelete: () => void;
}

export function BreakpointRow({ breakpoint, onEdit, onDelete }: BreakpointRowProps) {
    return (
        <div
            data-testid={`breakpoint-${breakpoint.id}`}
            onClick={onEdit}
            className="flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-pointer"
        >
            <Bug size={12} className={`flex-shrink-0 ${breakpoint.enabled ? 'text-blue-400' : 'text-app-muted'}`} />
            <span className="flex-1 text-app-secondary text-xs truncate">{breakpoint.name}</span>
            {breakpoint.response_mapping_enabled && (
                <span
                    title="Has response mapping"
                    className="flex-shrink-0 text-purple-400"
                    data-testid="rm-indicator"
                >
                    <ArrowLeftRight size={10} />
                </span>
            )}
            {breakpoint.status_code_enabled && (
                <span
                    title={`Overrides status code → ${breakpoint.status_code_value}`}
                    className="flex-shrink-0 text-orange-400"
                    data-testid="sc-indicator"
                >
                    <Gauge size={10} />
                </span>
            )}
            {(breakpoint.custom_headers ?? []).some((h) => h.enabled) && (
                <span
                    title={`Injects ${(breakpoint.custom_headers ?? []).filter((h) => h.enabled).length} custom header(s)`}
                    className="flex-shrink-0 text-teal-400"
                    data-testid="headers-indicator"
                >
                    <ListPlus size={10} />
                </span>
            )}
            <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    aria-label="Edit breakpoint"
                    title="Edit"
                    className="p-1 rounded text-app-muted hover:text-app-inverse cursor-pointer"
                >
                    <Pencil size={12} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    aria-label="Delete breakpoint"
                    title="Delete"
                    className="p-1 rounded text-red-400 hover:text-red-300 cursor-pointer"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
}

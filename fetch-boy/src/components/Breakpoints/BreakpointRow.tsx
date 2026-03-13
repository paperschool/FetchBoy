import { Bug, Pencil, Trash2 } from 'lucide-react';
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
            className="flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-default"
        >
            <Bug size={12} className={`flex-shrink-0 ${breakpoint.enabled ? 'text-blue-400' : 'text-app-muted'}`} />
            <span className="flex-1 text-app-secondary text-xs truncate">{breakpoint.name}</span>
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

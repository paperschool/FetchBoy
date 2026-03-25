import { useState } from 'react';
import { ChevronDown, ChevronRight, Folder as FolderIcon, Plus, Trash2 } from 'lucide-react';
import type { Mapping, MappingFolder } from '@/lib/db';
import { MappingRow } from './MappingRow';

interface MappingFolderRowProps {
    folder: MappingFolder;
    mappings: Mapping[];
    isExpanded: boolean;
    onToggle: () => void;
    onRename: (id: string, name: string) => void;
    onDelete: () => void;
    onAddMapping: () => void;
    onEditMapping: (id: string) => void;
    onDeleteMapping: (id: string) => void;
}

export function MappingFolderRow({
    folder,
    mappings,
    isExpanded,
    onToggle,
    onRename,
    onDelete,
    onAddMapping,
    onEditMapping,
    onDeleteMapping,
}: MappingFolderRowProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(folder.name);

    function handleCommit() {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== folder.name) {
            onRename(folder.id, trimmed);
        }
        setIsEditing(false);
    }

    return (
        <div data-testid={`mapping-folder-${folder.id}`}>
            <div className="flex items-center gap-1 py-0.5 px-1 rounded group hover:bg-gray-700 cursor-pointer select-none">
                <button
                    onClick={onToggle}
                    className="flex-shrink-0 text-app-muted cursor-pointer"
                    aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <FolderIcon size={14} className="flex-shrink-0 text-app-muted" />
                {isEditing ? (
                    <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCommit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommit();
                            if (e.key === 'Escape') { setEditValue(folder.name); setIsEditing(false); }
                        }}
                        className="flex-1 bg-gray-700 text-app-inverse text-sm outline-none px-1 rounded"
                        aria-label="Rename folder"
                    />
                ) : (
                    <span
                        className="flex-1 text-app-inverse text-sm truncate"
                        onDoubleClick={() => { setEditValue(folder.name); setIsEditing(true); }}
                    >
                        {folder.name}
                    </span>
                )}
                <div className="hidden group-hover:flex items-center gap-0.5 text-gray-300">
                    <button
                        onClick={(e) => { e.stopPropagation(); onAddMapping(); }}
                        aria-label="Add mapping to folder"
                        title="New Mapping"
                        className="p-1 rounded hover:text-white cursor-pointer"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        aria-label="Delete folder"
                        title="Delete"
                        className="p-1 rounded text-red-400 hover:text-red-300 cursor-pointer"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            {isExpanded && (
                <div className="ml-4">
                    {mappings.map((m) => (
                        <MappingRow
                            key={m.id}
                            mapping={m}
                            onEdit={() => onEditMapping(m.id)}
                            onDelete={() => onDeleteMapping(m.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

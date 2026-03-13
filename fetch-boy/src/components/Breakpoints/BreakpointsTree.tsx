import { useEffect, useState } from 'react';
import { Bug, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { FolderRow } from './FolderRow';
import { BreakpointRow } from './BreakpointRow';
import { useBreakpointsStore } from '@/stores/breakpointsStore';
import {
    loadAllBreakpoints,
    createBreakpointFolder,
    renameBreakpointFolder,
    deleteBreakpointFolder,
    createBreakpoint,
    deleteBreakpoint as dbDeleteBreakpoint,
} from '@/lib/breakpoints';

export function BreakpointsTree() {
    const { folders, breakpoints, loadAll, addFolder, renameFolder, deleteFolder, addBreakpoint, deleteBreakpoint } =
        useBreakpointsStore();
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadAllBreakpoints()
            .then(({ folders: f, breakpoints: bps }) => loadAll(f, bps))
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const tree = folders.map((folder) => ({
        folder,
        breakpoints: breakpoints.filter((bp) => bp.folder_id === folder.id),
    }));
    const rootBreakpoints = breakpoints.filter((bp) => bp.folder_id === null);

    async function handleAddFolder() {
        const name = window.prompt('Folder name:');
        if (!name?.trim()) return;
        const folder = await createBreakpointFolder(name.trim(), folders.length).catch(() => null);
        if (folder) addFolder(folder);
    }

    async function handleRenameFolder(id: string, name: string) {
        await renameBreakpointFolder(id, name).catch(() => {});
        renameFolder(id, name);
    }

    async function handleDeleteFolder(id: string) {
        await deleteBreakpointFolder(id).catch(() => {});
        deleteFolder(id);
    }

    async function handleAddBreakpoint(folderId: string | null) {
        const bp = await createBreakpoint(folderId, 'New Breakpoint', '', 'partial').catch(() => null);
        if (bp) addBreakpoint(bp);
    }

    async function handleDeleteBreakpoint(id: string) {
        await dbDeleteBreakpoint(id).catch(() => {});
        deleteBreakpoint(id);
    }

    if (folders.length === 0 && rootBreakpoints.length === 0) {
        return (
            <div data-testid="breakpoints-tree">
                <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-app-muted text-xs font-semibold uppercase tracking-widest">
                        Breakpoints
                    </span>
                    <button
                        onClick={() => void handleAddFolder()}
                        aria-label="Add Folder"
                        className="text-gray-300 hover:text-white p-1 rounded cursor-pointer"
                    >
                        <Plus size={16} />
                    </button>
                </div>
                <div data-testid="empty-state">
                    <EmptyState
                        icon={Bug}
                        label="No breakpoints yet — create a folder to get started"
                        action={() => void handleAddFolder()}
                        actionLabel="Create Folder"
                    />
                </div>
            </div>
        );
    }

    return (
        <div data-testid="breakpoints-tree" className="text-sm">
            <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-app-muted text-xs font-semibold uppercase tracking-widest">
                    Breakpoints
                </span>
                <button
                    onClick={() => void handleAddFolder()}
                    aria-label="Add Folder"
                    className="text-gray-300 hover:text-white p-1 rounded cursor-pointer"
                >
                    <Plus size={16} />
                </button>
            </div>

            {rootBreakpoints.map((bp) => (
                <BreakpointRow key={bp.id} breakpoint={bp} onDelete={() => void handleDeleteBreakpoint(bp.id)} />
            ))}

            {tree.map(({ folder, breakpoints: folderBps }) => (
                <FolderRow
                    key={folder.id}
                    folder={folder}
                    breakpoints={folderBps}
                    isExpanded={!!expanded[folder.id]}
                    onToggle={() => toggle(folder.id)}
                    onRename={(id, name) => void handleRenameFolder(id, name)}
                    onDelete={() => void handleDeleteFolder(folder.id)}
                    onAddBreakpoint={() => void handleAddBreakpoint(folder.id)}
                    onDeleteBreakpoint={(id) => void handleDeleteBreakpoint(id)}
                />
            ))}
        </div>
    );
}

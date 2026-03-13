import { useEffect, useRef, useState } from 'react';
import { Bug, FolderPlus, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { FolderRow } from './FolderRow';
import { BreakpointRow } from './BreakpointRow';
import { useBreakpointsStore } from '@/stores/breakpointsStore';
import {
    loadAllBreakpoints,
    createBreakpointFolder,
    renameBreakpointFolder,
    deleteBreakpointFolder,
    deleteBreakpoint as dbDeleteBreakpoint,
    syncBreakpointsToProxy,
} from '@/lib/breakpoints';

export function BreakpointsTree() {
    const {
        folders,
        breakpoints,
        loadAll,
        addFolder,
        renameFolder,
        deleteFolder,
        deleteBreakpoint,
        startEditing,
    } = useBreakpointsStore();
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const newFolderInputRef = useRef<HTMLInputElement>(null);
    // Prevent onBlur from double-committing when Enter was already handled
    const folderCommittedRef = useRef(false);

    useEffect(() => {
        loadAllBreakpoints()
            .then(({ folders: f, breakpoints: bps }) => loadAll(f, bps))
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        syncBreakpointsToProxy(breakpoints).catch(() => {});
    }, [breakpoints]);

    useEffect(() => {
        if (creatingFolder) newFolderInputRef.current?.focus();
    }, [creatingFolder]);

    const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const tree = folders.map((folder) => ({
        folder,
        breakpoints: breakpoints.filter((bp) => bp.folder_id === folder.id),
    }));
    const rootBreakpoints = breakpoints.filter((bp) => bp.folder_id === null);

    function handleStartCreateFolder() {
        setNewFolderName('');
        setCreatingFolder(true);
    }

    async function handleCommitNewFolder() {
        // Guard: prevent double-commit when both onKeyDown(Enter) and the
        // resulting onBlur fire in the same event cycle (input unmounts → blur).
        if (folderCommittedRef.current) return;
        folderCommittedRef.current = true;
        const name = newFolderName.trim();
        setCreatingFolder(false);
        setNewFolderName('');
        if (name) {
            const folder = await createBreakpointFolder(name, folders.length).catch(() => null);
            if (folder) addFolder(folder);
        }
        // Reset after a tick so any pending blur event from input unmount is absorbed.
        setTimeout(() => { folderCommittedRef.current = false; }, 0);
    }

    async function handleRenameFolder(id: string, name: string) {
        await renameBreakpointFolder(id, name).catch(() => {});
        renameFolder(id, name);
    }

    async function handleDeleteFolder(id: string) {
        await deleteBreakpointFolder(id).catch(() => {});
        deleteFolder(id);
    }

    function handleAddBreakpoint(folderId: string | null) {
        startEditing(undefined, folderId);
    }

    function handleEditBreakpoint(id: string) {
        const bp = breakpoints.find((b) => b.id === id);
        if (bp) startEditing(bp, bp.folder_id);
    }

    async function handleDeleteBreakpoint(id: string) {
        await dbDeleteBreakpoint(id).catch(() => {});
        deleteBreakpoint(id);
    }

    const header = (
        <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-app-muted text-xs font-semibold uppercase tracking-widest">
                Breakpoints
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => handleAddBreakpoint(null)}
                    aria-label="New Breakpoint"
                    title="New Breakpoint"
                    className="text-gray-300 hover:text-white p-1 rounded cursor-pointer"
                >
                    <Plus size={16} />
                </button>
                <button
                    onClick={handleStartCreateFolder}
                    aria-label="Add Folder"
                    title="Add Folder"
                    className="text-gray-300 hover:text-white p-1 rounded cursor-pointer"
                >
                    <FolderPlus size={16} />
                </button>
            </div>
        </div>
    );

    const newFolderInput = creatingFolder && (
        <input
            ref={newFolderInputRef}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={() => void handleCommitNewFolder()}
            onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCommitNewFolder();
                if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
            }}
            placeholder="Folder name…"
            className="w-full bg-gray-700 text-app-inverse text-sm outline-none px-2 py-1 rounded mb-1"
            aria-label="New folder name"
        />
    );

    if (folders.length === 0 && rootBreakpoints.length === 0) {
        return (
            <div data-testid="breakpoints-tree">
                {header}
                {newFolderInput}
                {!creatingFolder && (
                    <div data-testid="empty-state">
                        <EmptyState
                            icon={Bug}
                            label="No breakpoints yet"
                            action={handleStartCreateFolder}
                            actionLabel="Create Folder"
                        />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div data-testid="breakpoints-tree" className="text-sm">
            {header}
            {newFolderInput}

            {rootBreakpoints.map((bp) => (
                <BreakpointRow
                    key={bp.id}
                    breakpoint={bp}
                    onEdit={() => handleEditBreakpoint(bp.id)}
                    onDelete={() => void handleDeleteBreakpoint(bp.id)}
                />
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
                    onAddBreakpoint={() => handleAddBreakpoint(folder.id)}
                    onEditBreakpoint={(id) => handleEditBreakpoint(id)}
                    onDeleteBreakpoint={(id) => void handleDeleteBreakpoint(id)}
                />
            ))}
        </div>
    );
}

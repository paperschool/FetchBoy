import { useEffect, useRef, useState } from 'react';
import { Route, FolderPlus, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { MappingFolderRow } from './MappingFolderRow';
import { MappingRow } from './MappingRow';
import { useMappingsStore } from '@/stores/mappingsStore';
import {
    loadAllMappings,
    createMappingFolder,
    renameMappingFolder,
    deleteMappingFolder,
    syncMappingsToProxy,
} from '@/lib/mappings';

export function MappingsTree() {
    const { folders, mappings, loadAll, addFolder, renameFolder, deleteFolder, startEditing, deleteMapping } = useMappingsStore();
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const newFolderInputRef = useRef<HTMLInputElement>(null);
    const folderCommittedRef = useRef(false);

    useEffect(() => {
        loadAllMappings()
            .then(({ folders: f, mappings: ms }) => loadAll(f, ms))
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        syncMappingsToProxy(mappings).catch(() => {});
    }, [mappings]);

    useEffect(() => {
        if (creatingFolder) newFolderInputRef.current?.focus();
    }, [creatingFolder]);

    const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const tree = folders.map((folder) => ({
        folder,
        mappings: mappings.filter((m) => m.folder_id === folder.id),
    }));
    const rootMappings = mappings.filter((m) => m.folder_id === null);

    function handleStartCreateFolder() {
        setNewFolderName('');
        setCreatingFolder(true);
    }

    async function handleCommitNewFolder() {
        if (folderCommittedRef.current) return;
        folderCommittedRef.current = true;
        const name = newFolderName.trim();
        setCreatingFolder(false);
        setNewFolderName('');
        if (name) {
            const folder = await createMappingFolder(name, folders.length).catch(() => null);
            if (folder) addFolder(folder);
        }
        setTimeout(() => { folderCommittedRef.current = false; }, 0);
    }

    async function handleRenameFolder(id: string, name: string) {
        await renameMappingFolder(id, name).catch(() => {});
        renameFolder(id, name);
    }

    async function handleDeleteFolder(id: string) {
        await deleteMappingFolder(id).catch(() => {});
        deleteFolder(id);
    }

    function handleAddMapping(folderId: string | null) {
        startEditing(undefined, folderId);
    }

    function handleEditMapping(id: string) {
        const m = mappings.find((x) => x.id === id);
        if (m) startEditing(m, m.folder_id);
    }

    async function handleDeleteMapping(id: string) {
        await deleteMapping(id);
    }

    const header = (
        <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-app-muted text-xs font-semibold uppercase tracking-widest">Mappings</span>
            <div className="flex items-center gap-1">
                <button onClick={() => handleAddMapping(null)} aria-label="New Mapping" title="New Mapping"
                    className="text-gray-300 hover:text-white p-1 rounded cursor-pointer">
                    <Plus size={16} />
                </button>
                <button onClick={handleStartCreateFolder} aria-label="Add Folder" title="Add Folder"
                    className="text-gray-300 hover:text-white p-1 rounded cursor-pointer">
                    <FolderPlus size={16} />
                </button>
            </div>
        </div>
    );

    const newFolderInput = creatingFolder && (
        <input ref={newFolderInputRef} value={newFolderName}
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

    if (folders.length === 0 && rootMappings.length === 0) {
        return (
            <div data-testid="mappings-tree">
                {header}
                {newFolderInput}
                {!creatingFolder && (
                    <div data-testid="empty-state">
                        <EmptyState icon={Route} label="No mappings yet" action={handleStartCreateFolder} actionLabel="Create Folder" />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div data-testid="mappings-tree" className="text-sm">
            {header}
            {newFolderInput}
            {rootMappings.map((m) => (
                <MappingRow key={m.id} mapping={m} onEdit={() => handleEditMapping(m.id)} onDelete={() => void handleDeleteMapping(m.id)} />
            ))}
            {tree.map(({ folder, mappings: folderMappings }) => (
                <MappingFolderRow key={folder.id} folder={folder} mappings={folderMappings}
                    isExpanded={!!expanded[folder.id]} onToggle={() => toggle(folder.id)}
                    onRename={(id, name) => void handleRenameFolder(id, name)}
                    onDelete={() => void handleDeleteFolder(folder.id)}
                    onAddMapping={() => handleAddMapping(folder.id)}
                    onEditMapping={(id) => handleEditMapping(id)}
                    onDeleteMapping={(id) => void handleDeleteMapping(id)}
                />
            ))}
        </div>
    );
}

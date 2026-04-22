import { useState, useRef, useCallback } from 'react';
import { Copy, Pencil, Trash2, MoreVertical, Workflow, FolderInput, FolderOutput, Send } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { StitchChain, StitchFolder } from '@/types/stitch';
import { useAppTabStore } from '@/stores/appTabStore';
import { useInterceptStore } from '@/stores/interceptStore';
import { useMappingsStore } from '@/stores/mappingsStore';
import { loadAllMappings } from '@/lib/mappings';
import { t } from '@/lib/i18n';

const menuBtnClass = 'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-app-hover';

interface StitchSidebarEntryProps {
  chain: StitchChain;
  isActive: boolean;
  folders: StitchFolder[];
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveToFolder: (chainId: string, folderId: string | null) => void;
}

export function StitchSidebarEntry({
  chain,
  isActive,
  folders,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onMoveToFolder,
}: StitchSidebarEntryProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveSubmenuOpen, setMoveSubmenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chain.id,
    data: { type: 'chain', folderId: chain.folderId },
  });

  const startEdit = useCallback((): void => {
    setEditValue(chain.name);
    setEditing(true);
    setMenuOpen(false);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [chain.name]);

  const commitEdit = useCallback((): void => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== chain.name) onRename(chain.id, trimmed);
  }, [editValue, chain.id, chain.name, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') setEditing(false);
    },
    [commitEdit],
  );

  const updatedAt = chain.updatedAt ? new Date(chain.updatedAt) : null;
  const dateStr = updatedAt
    ? updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

  // Folders available for "Move to" (exclude current folder)
  const moveTargets = folders.filter((f) => f.id !== chain.folderId);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : undefined }}
      className={`group relative flex cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-sm ${
        isActive ? 'bg-blue-500/10 text-app-primary' : 'text-app-secondary hover:bg-app-hover'
      }`}
      onClick={() => !editing && onSelect(chain.id)}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
      data-testid={`chain-entry-${chain.id}`}
      {...attributes}
      {...listeners}
    >
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          className="min-w-0 flex-1 rounded border border-app-subtle bg-app-main px-1 text-xs text-app-primary outline-none"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          data-testid="chain-rename-input"
        />
      ) : (
        <>
          {chain.requestId && (
            <button
              className="shrink-0 text-teal-400 hover:text-teal-300"
              data-testid="pre-request-badge"
              title="Pre-Request chain — go to Fetch tab"
              onClick={(e) => {
                e.stopPropagation();
                useAppTabStore.getState().setActiveTab('fetch');
              }}
            >
              <Send size={10} />
            </button>
          )}
          {chain.mappingId && (
            <button
              className="shrink-0 text-yellow-400 hover:text-yellow-300"
              data-testid="mapper-badge"
              title="Open mapper"
              onClick={async (e) => {
                e.stopPropagation();
                let mapping = useMappingsStore.getState().mappings.find((m) => m.id === chain.mappingId);
                if (!mapping) {
                  const { mappings } = await loadAllMappings();
                  useMappingsStore.getState().loadAll(useMappingsStore.getState().folders, mappings);
                  mapping = mappings.find((m) => m.id === chain.mappingId);
                }
                if (mapping) {
                  useInterceptStore.getState().setSelectedRequestId(null);
                  useMappingsStore.getState().startEditing(mapping);
                  useAppTabStore.getState().setActiveTab('intercept');
                }
              }}
            >
              <Workflow size={10} />
            </button>
          )}
          <span
            className="min-w-0 flex-1 truncate"
            onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
            data-testid="chain-name"
          >
            {chain.name}
          </span>
          <span className="shrink-0 text-[10px] text-app-muted">{dateStr}</span>
        </>
      )}

      {!editing && (
        <button
          className="hidden shrink-0 rounded p-0.5 text-app-muted hover:text-app-secondary group-hover:block"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          title="Chain options"
          data-testid="chain-menu-button"
        >
          <MoreVertical size={12} />
        </button>
      )}

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setMenuOpen(false); setMoveSubmenuOpen(false); }} />
          <div
            ref={menuRef}
            className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-app-subtle bg-app-main py-1 shadow-lg"
            data-testid="chain-context-menu"
          >
            <button
              className={`${menuBtnClass} text-app-secondary`}
              onClick={(e) => { e.stopPropagation(); startEdit(); }}
            >
              <Pencil size={11} /> {t('stitch.rename')}
            </button>
            <button
              className={`${menuBtnClass} text-app-secondary`}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate(chain.id); }}
            >
              <Copy size={11} /> {t('stitch.duplicate')}
            </button>

            {/* Move to Folder submenu */}
            <div className="relative">
              <button
                className={`${menuBtnClass} text-app-secondary`}
                onClick={(e) => { e.stopPropagation(); setMoveSubmenuOpen((v) => !v); }}
              >
                <FolderInput size={11} /> {t('stitch.moveToFolder')}
              </button>
              {moveSubmenuOpen && (
                <div className="absolute left-full top-0 z-50 ml-1 w-36 rounded-md border border-app-subtle bg-app-main py-1 shadow-lg">
                  {chain.folderId && (
                    <button
                      className={`${menuBtnClass} text-app-secondary`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        setMoveSubmenuOpen(false);
                        onMoveToFolder(chain.id, null);
                      }}
                    >
                      <FolderOutput size={11} /> {t('stitch.moveToRoot')}
                    </button>
                  )}
                  {moveTargets.map((f) => (
                    <button
                      key={f.id}
                      className={`${menuBtnClass} truncate text-app-secondary`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        setMoveSubmenuOpen(false);
                        onMoveToFolder(chain.id, f.id);
                      }}
                    >
                      {f.name}
                    </button>
                  ))}
                  {moveTargets.length === 0 && !chain.folderId && (
                    <p className="px-3 py-1.5 text-[10px] text-app-muted">No folders</p>
                  )}
                </div>
              )}
            </div>

            {chain.mappingId && (
              <button
                className={`${menuBtnClass} text-yellow-400`}
                onClick={async (e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  let mapping = useMappingsStore.getState().mappings.find((m) => m.id === chain.mappingId);
                  if (!mapping) {
                    const { mappings } = await loadAllMappings();
                    useMappingsStore.getState().loadAll(useMappingsStore.getState().folders, mappings);
                    mapping = mappings.find((m) => m.id === chain.mappingId);
                  }
                  if (mapping) {
                    useInterceptStore.getState().setSelectedRequestId(null);
                    useMappingsStore.getState().startEditing(mapping);
                    useAppTabStore.getState().setActiveTab('intercept');
                  }
                }}
                data-testid="chain-open-mapper"
              >
                <Workflow size={11} /> Open Mapper
              </button>
            )}

            <button
              className={`${menuBtnClass} text-red-400`}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(chain.id); }}
            >
              <Trash2 size={11} /> {t('stitch.delete')}
            </button>
          </div>
        </>
      )}
    </li>
  );
}

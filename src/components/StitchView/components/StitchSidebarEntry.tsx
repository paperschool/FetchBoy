import { useState, useRef, useCallback } from 'react';
import { Copy, Pencil, Trash2, MoreVertical } from 'lucide-react';
import type { StitchChain } from '@/types/stitch';

interface StitchSidebarEntryProps {
  chain: StitchChain;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function StitchSidebarEntry({
  chain,
  isActive,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
}: StitchSidebarEntryProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const startEdit = useCallback((): void => {
    setEditValue(chain.name);
    setEditing(true);
    setMenuOpen(false);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [chain.name]);

  const commitEdit = useCallback((): void => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== chain.name) {
      onRename(chain.id, trimmed);
    }
  }, [editValue, chain.id, chain.name, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') setEditing(false);
    },
    [commitEdit],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault();
      setMenuOpen((v) => !v);
    },
    [],
  );

  const handleClickOutsideMenu = useCallback((): void => {
    setMenuOpen(false);
  }, []);

  const updatedAt = chain.updatedAt ? new Date(chain.updatedAt) : null;
  const dateStr = updatedAt
    ? updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

  return (
    <li
      className={`group relative flex cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-sm ${
        isActive ? 'bg-blue-500/10 text-app-primary' : 'text-app-secondary hover:bg-app-hover'
      }`}
      onClick={() => !editing && onSelect(chain.id)}
      onContextMenu={handleContextMenu}
      data-testid={`chain-entry-${chain.id}`}
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
          <span
            className="min-w-0 flex-1 truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEdit();
            }}
            data-testid="chain-name"
          >
            {chain.name}
          </span>
          <span className="shrink-0 text-[10px] text-app-muted">{dateStr}</span>
        </>
      )}

      {/* Menu button */}
      {!editing && (
        <button
          className="hidden shrink-0 rounded p-0.5 text-app-muted hover:text-app-secondary group-hover:block"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          title="Chain options"
          data-testid="chain-menu-button"
        >
          <MoreVertical size={12} />
        </button>
      )}

      {/* Context menu dropdown */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleClickOutsideMenu} />
          <div
            ref={menuRef}
            className="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border border-app-subtle bg-app-main py-1 shadow-lg"
            data-testid="chain-context-menu"
          >
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-app-secondary hover:bg-app-hover"
              onClick={(e) => {
                e.stopPropagation();
                startEdit();
              }}
            >
              <Pencil size={11} /> Rename
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-app-secondary hover:bg-app-hover"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDuplicate(chain.id);
              }}
            >
              <Copy size={11} /> Duplicate
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-app-hover"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete(chain.id);
              }}
            >
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}

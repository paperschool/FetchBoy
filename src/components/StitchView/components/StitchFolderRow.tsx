import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, FolderPlus, Trash2 } from 'lucide-react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndMonitor } from '@dnd-kit/core';
import type { StitchFolder } from '@/types/stitch';
import type { TreeFolder } from '../hooks/useStitchSidebarState';
import { StitchSidebarEntry } from './StitchSidebarEntry';
import { t } from '@/lib/i18n';

interface StitchFolderRowProps {
  treeFolder: TreeFolder;
  isExpanded: boolean;
  expanded: Record<string, boolean>;
  editingId: string | null;
  editingValue: string;
  editRef: React.MutableRefObject<HTMLInputElement | null>;
  activeChainId: string | null;
  folders: StitchFolder[];
  onToggle: (id: string) => void;
  onEditChange: (v: string) => void;
  onStartEditFolder: (id: string, name: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onAddChain: (folderId: string) => void;
  onAddSubfolder: (parentId: string) => void;
  onDeleteFolder: (id: string) => void;
  onSelectChain: (id: string) => void;
  onRenameChain: (id: string, name: string) => void;
  onDuplicateChain: (id: string) => void;
  onDeleteChain: (id: string) => void;
  onMoveChainToFolder: (chainId: string, folderId: string | null) => void;
}

export function StitchFolderRow({
  treeFolder,
  isExpanded,
  expanded,
  editingId,
  editingValue,
  editRef,
  activeChainId,
  folders,
  onToggle,
  onEditChange,
  onStartEditFolder,
  onCommitEdit,
  onCancelEdit,
  onAddChain,
  onAddSubfolder,
  onDeleteFolder,
  onSelectChain,
  onRenameChain,
  onDuplicateChain,
  onDeleteChain,
  onMoveChainToFolder,
}: StitchFolderRowProps): React.ReactElement {
  const { folder, chains, subfolders } = treeFolder;
  const isEditing = editingId === folder.id;
  const chainIds = chains.map((c) => c.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id,
    data: { type: 'folder', folderId: folder.parentId },
  });

  const [isOver, setIsOver] = useState(false);
  useDndMonitor({
    onDragOver(event) { setIsOver(!isDragging && String(event.over?.id) === folder.id); },
    onDragEnd() { setIsOver(false); },
    onDragCancel() { setIsOver(false); },
  });

  return (
    <>
      {isOver && <div className="mx-1 h-0.5 rounded bg-blue-400 pointer-events-none" />}
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : undefined }}
      >
        <div
          className="group flex cursor-pointer select-none items-center gap-1 rounded px-1 py-0.5 hover:bg-gray-700"
          {...attributes}
          {...listeners}
        >
          <button onClick={() => onToggle(folder.id)} className="shrink-0 text-app-muted">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {isEditing ? (
            <input
              ref={editRef}
              className="min-w-0 flex-1 rounded bg-gray-700 px-1 text-sm text-app-inverse outline-none"
              value={editingValue}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={onCommitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommitEdit();
                if (e.key === 'Escape') onCancelEdit();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="min-w-0 flex-1 truncate text-sm text-app-inverse"
              onDoubleClick={() => onStartEditFolder(folder.id, folder.name)}
            >
              {folder.name}
            </span>
          )}

          <div className="hidden items-center gap-0.5 text-gray-300 group-hover:flex">
            <button
              onClick={(e) => { e.stopPropagation(); onAddChain(folder.id); }}
              title={t('stitch.addChainToFolder')}
              className="cursor-pointer rounded p-0.5 hover:text-white"
              draggable={false}
            >
              <Plus size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddSubfolder(folder.id); }}
              title={t('stitch.addSubfolder')}
              className="cursor-pointer rounded p-0.5 hover:text-white"
              draggable={false}
            >
              <FolderPlus size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
              title={t('stitch.delete')}
              className="cursor-pointer rounded p-0.5 text-red-400 hover:text-red-300"
              draggable={false}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="ml-3">
            {subfolders.map((sf) => (
              <StitchFolderRow
                key={sf.folder.id}
                treeFolder={sf}
                isExpanded={Boolean(expanded[sf.folder.id])}
                expanded={expanded}
                editingId={editingId}
                editingValue={editingValue}
                editRef={editRef}
                activeChainId={activeChainId}
                folders={folders}
                onToggle={onToggle}
                onEditChange={onEditChange}
                onStartEditFolder={onStartEditFolder}
                onCommitEdit={onCommitEdit}
                onCancelEdit={onCancelEdit}
                onAddChain={onAddChain}
                onAddSubfolder={onAddSubfolder}
                onDeleteFolder={onDeleteFolder}
                onSelectChain={onSelectChain}
                onRenameChain={onRenameChain}
                onDuplicateChain={onDuplicateChain}
                onDeleteChain={onDeleteChain}
                onMoveChainToFolder={onMoveChainToFolder}
              />
            ))}
            <SortableContext items={chainIds} strategy={verticalListSortingStrategy}>
              {chains.map((chain) => (
                <StitchSidebarEntry
                  key={chain.id}
                  chain={chain}
                  isActive={chain.id === activeChainId}
                  folders={folders}
                  onSelect={onSelectChain}
                  onRename={onRenameChain}
                  onDuplicate={onDuplicateChain}
                  onDelete={onDeleteChain}
                  onMoveToFolder={onMoveChainToFolder}
                />
              ))}
            </SortableContext>
            {chains.length === 0 && subfolders.length === 0 && (
              <p className="px-2 py-1 text-[10px] text-app-muted">{t('stitch.noFolderChains')}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

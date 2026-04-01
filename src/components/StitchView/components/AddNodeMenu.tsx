import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Send, Code, Braces, Timer, Repeat, GitMerge, GitBranch } from 'lucide-react';
import type { StitchNodeType } from '@/types/stitch';

const NODE_TYPE_OPTIONS: { type: StitchNodeType; label: string; icon: React.ReactNode }[] = [
  { type: 'request', label: 'Request', icon: <Send size={14} /> },
  { type: 'js-snippet', label: 'JS Snippet', icon: <Code size={14} /> },
  { type: 'json-object', label: 'JSON Object', icon: <Braces size={14} /> },
  { type: 'sleep', label: 'Sleep', icon: <Timer size={14} /> },
  { type: 'loop', label: 'Loop', icon: <Repeat size={14} /> },
  { type: 'merge', label: 'Merge', icon: <GitMerge size={14} /> },
  { type: 'condition', label: 'Condition', icon: <GitBranch size={14} /> },
];

interface AddNodeMenuProps {
  onAddNode: (type: StitchNodeType) => void;
  disabled?: boolean;
}

export function AddNodeMenu({ onAddNode, disabled }: AddNodeMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback((): void => {
    if (disabled) return;
    setOpen((prev) => !prev);
  }, [disabled]);

  const handleSelect = useCallback((type: StitchNodeType): void => {
    onAddNode(type);
    setOpen(false);
  }, [onAddNode]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef} data-stitch-toolbar>
      <button
        className={`flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${disabled ? 'border-app-subtle text-app-muted cursor-not-allowed opacity-40' : 'border-green-500 text-green-500 hover:bg-green-500/15'}`}
        onClick={handleToggle}
        disabled={disabled}
        data-testid="add-node-button"
      >
        <Plus size={12} />
        Add Node
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 min-w-[140px] rounded border border-app-subtle bg-app-main shadow-lg">
          {NODE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-app-secondary hover:bg-app-hover"
              onClick={() => handleSelect(opt.type)}
              data-testid={`add-node-${opt.type}`}
            >
              <span className="text-app-muted">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

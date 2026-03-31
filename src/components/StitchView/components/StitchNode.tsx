import React, { useState, useCallback, useRef, useMemo, type PointerEvent, type KeyboardEvent } from 'react';
import { Send, Code, Braces, Timer, Eye, AlertCircle } from 'lucide-react';
import type { StitchNode as StitchNodeType } from '@/types/stitch';
import type { StitchNodeType as NodeType } from '@/types/stitch';
import { extractJsonKeys } from '../utils/jsonKeyExtractor';
import { extractReturnKeys } from '../utils/jsKeyExtractor';

const NODE_ICONS: Record<NodeType, React.ReactNode> = {
  'request': <Send size={12} />,
  'js-snippet': <Code size={12} />,
  'json-object': <Braces size={12} />,
  'sleep': <Timer size={12} />,
};

const NODE_COLORS: Record<NodeType, string> = {
  'request': 'bg-blue-500/10 border-blue-500/30',
  'js-snippet': 'bg-amber-500/10 border-amber-500/30',
  'json-object': 'bg-green-500/10 border-green-500/30',
  'sleep': 'bg-purple-500/10 border-purple-500/30',
};

const NODE_HEADER_COLORS: Record<NodeType, string> = {
  'request': 'bg-blue-500/20',
  'js-snippet': 'bg-amber-500/20',
  'json-object': 'bg-green-500/20',
  'sleep': 'bg-purple-500/20',
};

interface StitchNodeProps {
  node: StitchNodeType;
  selected: boolean;
  zoom: number;
  panX: number;
  panY: number;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onDelete: (id: string) => void;
}

export const StitchNode = React.memo(function StitchNode({
  node,
  selected,
  zoom,
  onSelect,
  onUpdatePosition,
  onUpdateLabel,
  onDelete,
}: StitchNodeProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, nodeX: 0, nodeY: 0 });

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(node.id);
    dragRef.current = { startX: e.clientX, startY: e.clientY, nodeX: node.positionX, nodeY: node.positionY };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [node.id, node.positionX, node.positionY, onSelect]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return;
    const dx = (e.clientX - dragRef.current.startX) / zoom;
    const dy = (e.clientY - dragRef.current.startY) / zoom;
    onUpdatePosition(node.id, dragRef.current.nodeX + dx, dragRef.current.nodeY + dy);
  }, [dragging, zoom, node.id, onUpdatePosition]);

  const handlePointerUp = useCallback((): void => {
    setDragging(false);
  }, []);

  const handleDoubleClick = useCallback((): void => {
    setEditValue(node.label ?? '');
    setEditing(true);
  }, [node.label]);

  const handleLabelBlur = useCallback((): void => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== node.label) {
      onUpdateLabel(node.id, trimmed);
    }
  }, [editValue, node.id, node.label, onUpdateLabel]);

  const handleLabelKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(node.id);
  }, [node.id, onDelete]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !editing) {
      e.preventDefault();
      onDelete(node.id);
    }
  }, [selected, editing, node.id, onDelete]);

  const displayLabel = node.label || `${node.type}`;

  const portResult = useMemo(() => {
    if (node.type === 'json-object') {
      const jsonStr = (node.config as { json?: string }).json ?? '';
      return extractJsonKeys(jsonStr);
    }
    if (node.type === 'js-snippet') {
      const code = (node.config as { code?: string }).code ?? '';
      return extractReturnKeys(code);
    }
    return null;
  }, [node.type, node.config]);

  const outputKeys = portResult?.keys ?? [];
  const hasError = portResult !== null && portResult.error !== null;
  const hasDynamicPorts = node.type === 'json-object' || node.type === 'js-snippet';
  const portColor = node.type === 'js-snippet' ? 'amber' : 'green';

  return (
    <div
      data-stitch-node
      data-testid={`stitch-node-${node.id}`}
      tabIndex={0}
      className={`absolute select-none rounded-lg border shadow-sm transition-shadow ${NODE_COLORS[node.type]} ${
        selected ? 'ring-2 ring-blue-500 shadow-md' : ''
      } ${dragging ? 'opacity-75' : ''}`}
      style={{
        left: node.positionX,
        top: node.positionY,
        width: 180,
        minHeight: 70,
      }}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      {/* Input port indicator (top) */}
      <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-app-subtle bg-app-main" />

      {/* Title bar — drag handle */}
      <div
        className={`flex cursor-grab items-center gap-1.5 rounded-t-lg px-2 py-1.5 ${NODE_HEADER_COLORS[node.type]} ${dragging ? 'cursor-grabbing' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="text-app-secondary">{NODE_ICONS[node.type]}</span>
        {editing ? (
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-app-subtle bg-app-main px-1 text-xs text-app-primary outline-none"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={handleLabelKeyDown}
          />
        ) : (
          <span
            className="min-w-0 flex-1 truncate text-xs font-medium text-app-primary"
            onDoubleClick={handleDoubleClick}
          >
            {displayLabel}
          </span>
        )}
        <button
          className="text-app-muted hover:text-app-secondary"
          title="Preview"
          onClick={(e) => e.stopPropagation()}
        >
          <Eye size={11} />
        </button>
      </div>

      {/* Body */}
      <div className="px-2 py-1.5">
        {hasError ? (
          <span className="flex items-center gap-1 text-[10px] text-red-500" title={portResult?.error ?? ''} data-testid="node-error">
            <AlertCircle size={10} />
            {node.type === 'json-object' ? 'Invalid JSON' : 'Syntax error'}
          </span>
        ) : hasDynamicPorts && outputKeys.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {outputKeys.map((key) => (
              <span key={key} className={`rounded px-1 py-0.5 text-[9px] ${portColor === 'amber' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-green-500/15 text-green-700 dark:text-green-400'}`} data-testid={`port-${key}`}>
                {key}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-app-muted">{node.type}</span>
        )}
      </div>

      {/* Output ports */}
      {hasDynamicPorts && !hasError && outputKeys.length > 0 ? (
        <div className="relative h-3">
          {outputKeys.map((key, i) => {
            const offset = outputKeys.length === 1 ? 0.5 : i / (outputKeys.length - 1);
            const leftPercent = 10 + offset * 80;
            return (
              <div
                key={key}
                className={`absolute -bottom-1.5 h-3 w-3 rounded-full border-2 bg-app-main ${portColor === 'amber' ? 'border-amber-500/50' : 'border-green-500/50'}`}
                style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                title={key}
                data-testid={`output-port-${key}`}
              />
            );
          })}
        </div>
      ) : (
        <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-app-subtle bg-app-main" />
      )}
    </div>
  );
});

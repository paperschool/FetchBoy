import React, { useCallback, useRef, useState, useMemo, type PointerEvent, type KeyboardEvent } from 'react';
import { Repeat, Eye } from 'lucide-react';
import type { StitchNode as StitchNodeType, StitchConnection, ExecutionNodeStatus, LoopNodeConfig } from '@/types/stitch';
import { useConnectionDrag } from './StitchConnectionDragContext';

const LOOP_PADDING = 20;
const LOOP_HEADER_HEIGHT = 32;
const LOOP_MIN_WIDTH = 240;
const LOOP_MIN_HEIGHT = 120;
const MAX_CHILDREN = 4;

interface StitchLoopNodeProps {
  node: StitchNodeType;
  childNodes: StitchNodeType[];
  selected: boolean;
  zoom: number;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onConnectionDrop?: (targetNodeId: string) => void;
  executionStatus?: ExecutionNodeStatus | null;
  connections?: StitchConnection[];
}

export { MAX_CHILDREN as LOOP_MAX_CHILDREN };

export const StitchLoopNode = React.memo(function StitchLoopNode({
  node,
  childNodes,
  selected,
  zoom,
  onSelect,
  onUpdatePosition,
  onUpdateLabel,
  onDelete,
  onConnectionDrop,
  executionStatus = null,
}: StitchLoopNodeProps): React.ReactElement {
  const { drag, startDrag, updateCursor, endDrag } = useConnectionDrag();
  const nodeRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, nodeX: 0, nodeY: 0 });

  const config = node.config as unknown as LoopNodeConfig;
  const delayMs = config.delayMs ?? 100;

  // Calculate bounds from children
  const bounds = useMemo(() => {
    if (childNodes.length === 0) {
      return { width: LOOP_MIN_WIDTH, height: LOOP_MIN_HEIGHT };
    }
    let maxRight = 0;
    let maxBottom = 0;
    for (const child of childNodes) {
      const relX = child.positionX - node.positionX;
      const relY = child.positionY - node.positionY;
      maxRight = Math.max(maxRight, relX + 180 + LOOP_PADDING);
      maxBottom = Math.max(maxBottom, relY + 100 + LOOP_PADDING);
    }
    return {
      width: Math.max(LOOP_MIN_WIDTH, maxRight + LOOP_PADDING),
      height: Math.max(LOOP_MIN_HEIGHT, maxBottom + LOOP_PADDING - LOOP_HEADER_HEIGHT),
    };
  }, [childNodes, node.positionX, node.positionY]);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(node.id);
    dragRef.current = { startX: e.clientX, startY: e.clientY, nodeX: node.positionX, nodeY: node.positionY };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
    if (trimmed && trimmed !== node.label) onUpdateLabel(node.id, trimmed);
  }, [editValue, node.id, node.label, onUpdateLabel]);

  const handleLabelKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    else if (e.key === 'Escape') setEditing(false);
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

  const handleOutputPortDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    e.preventDefault();
    const portX = node.positionX + bounds.width / 2;
    const portY = node.positionY + LOOP_HEADER_HEIGHT + bounds.height;
    startDrag(node.id, '__output__', portX, portY);
    const onMove = (ev: globalThis.PointerEvent): void => {
      const dx = (ev.clientX - e.clientX) / zoom;
      const dy = (ev.clientY - e.clientY) / zoom;
      updateCursor(portX + dx, portY + dy);
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      endDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [node.id, node.positionX, node.positionY, bounds, zoom, startDrag, updateCursor, endDrag]);

  const handleInputSlotPointerUp = useCallback((): void => {
    if (drag && drag.sourceNodeId !== node.id && onConnectionDrop) {
      onConnectionDrop(node.id);
    }
  }, [drag, node.id, onConnectionDrop]);

  const isDragTarget = drag !== null && drag.sourceNodeId !== node.id;
  const displayLabel = node.label || 'Loop';

  return (
    <div
      ref={nodeRef}
      data-stitch-node
      data-testid={`stitch-loop-${node.id}`}
      data-node-id={node.id}
      tabIndex={0}
      className={`absolute select-none rounded-lg border-2 border-dashed shadow-sm transition-shadow border-cyan-500/40 bg-cyan-500/5 ${
        selected ? 'ring-2 ring-cyan-400 shadow-md' : ''
      } ${dragging ? 'opacity-75' : ''} ${
        executionStatus === 'running' ? 'stitch-node-running' : ''
      } ${executionStatus === 'success' ? 'stitch-node-success' : ''} ${
        executionStatus === 'error' ? 'stitch-node-error' : ''
      }`}
      style={{
        left: node.positionX,
        top: node.positionY,
        width: bounds.width,
        minHeight: LOOP_HEADER_HEIGHT + bounds.height,
      }}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      {/* Input port */}
      <div
        className={`absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 bg-app-main transition-colors ${
          isDragTarget ? 'border-green-500 scale-150' : 'border-cyan-500/50'
        }`}
        onPointerUp={handleInputSlotPointerUp}
        data-testid="loop-input-slot"
      />

      {/* Header — drag handle */}
      <div
        className={`flex cursor-grab items-center gap-1.5 rounded-t-lg px-2 py-1.5 bg-cyan-500/15 ${dragging ? 'cursor-grabbing' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="text-cyan-600 dark:text-cyan-400"><Repeat size={12} /></span>
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
        <span className="text-[9px] font-mono text-cyan-600 dark:text-cyan-400">{delayMs}ms</span>
        <span className="text-[9px] text-app-muted">{childNodes.length}/{MAX_CHILDREN}</span>
        <button
          className="text-app-muted hover:text-app-secondary"
          title="Preview"
          onClick={(e) => e.stopPropagation()}
        >
          <Eye size={11} />
        </button>
      </div>

      {/* Drop zone body */}
      <div
        className="relative"
        style={{ minHeight: bounds.height }}
        data-testid="loop-drop-zone"
      >
        {childNodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-[10px] text-app-muted">Drop nodes here (max {MAX_CHILDREN})</p>
          </div>
        )}
      </div>

      {/* Output port */}
      <div
        className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-cyan-500/50 bg-app-main transition-transform hover:scale-150 hover:border-blue-500"
        data-testid="loop-output-port"
        onPointerDown={handleOutputPortDown}
      />
    </div>
  );
});

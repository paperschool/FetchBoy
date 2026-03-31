import React, { useCallback, useRef, useState, useMemo, type PointerEvent, type KeyboardEvent } from 'react';
import { Globe, Eye } from 'lucide-react';
import type { StitchNode as StitchNodeType, StitchConnection, ExecutionNodeStatus, MappingNodeConfig } from '@/types/stitch';
import { useStitchStore } from '@/stores/stitchStore';
import { useConnectionDrag } from './StitchConnectionDragContext';

const MAPPING_PADDING = 20;
const MAPPING_HEADER_HEIGHT = 32;
const MAPPING_MIN_WIDTH = 420;
const MAPPING_MIN_HEIGHT = 160;

interface StitchMappingNodeProps {
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

export const StitchMappingNode = React.memo(function StitchMappingNode({
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
}: StitchMappingNodeProps): React.ReactElement {
  const { drag, startDrag, updateCursor, endDrag } = useConnectionDrag();
  const nodeRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, nodeX: 0, nodeY: 0 });

  const config = node.config as unknown as MappingNodeConfig;
  const hasOutput = useStitchStore((s) => node.id in s.executionNodeOutputs);

  const bounds = useMemo(() => {
    if (childNodes.length === 0) {
      return { width: MAPPING_MIN_WIDTH, height: MAPPING_MIN_HEIGHT };
    }
    let maxRight = 0;
    let maxBottom = 0;
    for (const child of childNodes) {
      const relX = child.positionX - node.positionX;
      const relY = child.positionY - node.positionY;
      maxRight = Math.max(maxRight, relX + 180 + MAPPING_PADDING);
      maxBottom = Math.max(maxBottom, relY + 100 + MAPPING_PADDING);
    }
    return {
      width: Math.max(MAPPING_MIN_WIDTH, maxRight + MAPPING_PADDING),
      height: Math.max(MAPPING_MIN_HEIGHT, maxBottom + MAPPING_PADDING - MAPPING_HEADER_HEIGHT),
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
    const portY = node.positionY + MAPPING_HEADER_HEIGHT + bounds.height;
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
  const displayLabel = node.label || 'Mapping';
  const urlHint = config.urlPattern ? config.urlPattern : '';

  return (
    <div
      ref={nodeRef}
      data-stitch-node
      data-testid={`stitch-mapping-${node.id}`}
      data-node-id={node.id}
      tabIndex={0}
      className={`absolute select-none rounded-lg border-2 border-dashed shadow-sm transition-shadow border-yellow-500/40 bg-yellow-500/5 ${
        selected ? 'ring-2 ring-yellow-400 shadow-md' : ''
      } ${dragging ? 'opacity-75' : ''} ${
        executionStatus === 'running' ? 'stitch-node-running' : ''
      } ${executionStatus === 'success' ? 'stitch-node-success' : ''} ${
        executionStatus === 'error' ? 'stitch-node-error' : ''
      }`}
      style={{
        left: node.positionX,
        top: node.positionY,
        width: bounds.width,
        minHeight: MAPPING_HEADER_HEIGHT + bounds.height,
      }}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      {/* Input port */}
      <div
        className={`absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 bg-app-main transition-colors ${
          isDragTarget ? 'border-green-500 scale-150' : 'border-yellow-500/50'
        }`}
        onPointerUp={handleInputSlotPointerUp}
        data-testid="mapping-input-slot"
      />

      {/* Header */}
      <div
        className={`flex cursor-grab items-center gap-1.5 rounded-t-lg px-2 py-1.5 bg-yellow-500/15 ${dragging ? 'cursor-grabbing' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="text-yellow-600 dark:text-yellow-400"><Globe size={12} /></span>
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
        {urlHint && (
          <span className="max-w-[10rem] truncate text-[9px] font-mono text-yellow-600 dark:text-yellow-400" title={urlHint}>
            {urlHint}
          </span>
        )}
        <button
          className={`transition-opacity ${hasOutput ? 'text-app-muted hover:text-app-secondary' : 'text-app-muted/30 cursor-default'}`}
          title={hasOutput ? 'Preview last output' : 'No results'}
          onClick={(e) => {
            e.stopPropagation();
            if (!hasOutput) return;
            const store = useStitchStore.getState();
            if (store.previewNodeId === node.id && store.bottomPanel === 'preview') {
              useStitchStore.setState({ previewNodeId: null, bottomPanel: 'none', selectedNodeId: node.id });
            } else {
              store.setPreviewNode(node.id);
            }
          }}
        >
          <Eye size={11} />
        </button>
      </div>

      {/* Drop zone body */}
      <div
        className="relative"
        style={{ minHeight: bounds.height }}
        data-testid="mapping-drop-zone"
      >
        {childNodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-[10px] text-app-muted">Drop nodes here</p>
          </div>
        )}
      </div>

      {/* Output port */}
      <div
        className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-yellow-500/50 bg-app-main transition-transform hover:scale-150 hover:border-blue-500"
        data-testid="mapping-output-port"
        onPointerDown={handleOutputPortDown}
      />
    </div>
  );
});

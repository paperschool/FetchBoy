import React, { useCallback, useRef, useState, useMemo, type PointerEvent, type KeyboardEvent } from 'react';
import { Globe, Eye } from 'lucide-react';
import type { StitchNode as StitchNodeType, StitchConnection, ExecutionNodeStatus, MappingNodeConfig } from '@/types/stitch';
import { useStitchStore } from '@/stores/stitchStore';

const MAPPING_PADDING = 40;
const MAPPING_HEADER_HEIGHT = 32;
const MAPPING_BASE_MIN_WIDTH = 420;
const MAPPING_BASE_MIN_HEIGHT = 160;

interface StitchMappingNodeProps {
  node: StitchNodeType;
  childNodes: StitchNodeType[];
  selected: boolean;
  zoom: number;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onConnectionDrop?: (targetNodeId: string, targetSlot?: string) => void;
  onDragEnd?: (id: string) => void;
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
  onDelete: _onDelete,
  onConnectionDrop: _onConnectionDrop,
  onDragEnd,
  executionStatus = null,
}: StitchMappingNodeProps): React.ReactElement {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, nodeX: 0, nodeY: 0 });

  const config = node.config as unknown as MappingNodeConfig;
  const hasOutput = useStitchStore((s) => node.id in s.executionNodeOutputs);

  // Measure canvas to fill the visible viewport
  const canvasMinSize = useMemo(() => {
    const el = document.querySelector('[data-testid="stitch-canvas"]');
    if (!el) return { w: MAPPING_BASE_MIN_WIDTH, h: MAPPING_BASE_MIN_HEIGHT };
    const rect = (el as HTMLElement).getBoundingClientRect();
    // Use canvas size (unscaled) as the minimum — generously padded
    return { w: Math.max(MAPPING_BASE_MIN_WIDTH, rect.width - 40), h: Math.max(MAPPING_BASE_MIN_HEIGHT, rect.height - 80) };
  // Re-measure on child changes (proxy for layout updates)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childNodes]);

  const bounds = useMemo(() => {
    let maxRight = 0;
    let maxBottom = 0;
    for (const child of childNodes) {
      const relX = child.positionX - node.positionX;
      const relY = child.positionY - node.positionY;
      maxRight = Math.max(maxRight, relX + 180 + MAPPING_PADDING);
      maxBottom = Math.max(maxBottom, relY + 100 + MAPPING_PADDING);
    }
    return {
      width: Math.max(canvasMinSize.w, maxRight + MAPPING_PADDING),
      height: Math.max(canvasMinSize.h, maxBottom + MAPPING_PADDING - MAPPING_HEADER_HEIGHT),
    };
  }, [childNodes, node.positionX, node.positionY, canvasMinSize]);

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
    if (dragging) onDragEnd?.(node.id);
    setDragging(false);
  }, [dragging, node.id, onDragEnd]);

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
    // Mapping containers are mapper-bound — prevent accidental deletion via right-click
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
    // Prevent keyboard deletion of mapper-bound containers
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !editing) {
      e.preventDefault();
    }
  }, [selected, editing]);

  const displayLabel = node.label || 'Mapping';
  const urlHint = config.urlPattern ? config.urlPattern : '';

  return (
    <div
      ref={nodeRef}
      data-stitch-node
      data-testid={`stitch-mapping-${node.id}`}
      data-node-id={node.id}
      tabIndex={0}
      className={`pointer-events-none absolute select-none rounded-lg border-2 border-dashed shadow-sm transition-shadow border-yellow-500/40 bg-yellow-500/5 ${
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
      {/* Header — pointer-events-auto so dragging works */}
      <div
        className={`pointer-events-auto flex cursor-grab items-center gap-1.5 rounded-t-lg px-2 py-1.5 bg-yellow-500/15 ${dragging ? 'cursor-grabbing' : ''}`}
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

    </div>
  );
});

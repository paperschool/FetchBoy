import React, { useState, useCallback, useRef, useMemo, type PointerEvent, type KeyboardEvent } from 'react';
import { Send, Code, Braces, Timer, Eye, AlertCircle } from 'lucide-react';
import type { StitchNode as StitchNodeType } from '@/types/stitch';
import type { StitchNodeType as NodeType } from '@/types/stitch';
import { extractJsonKeys } from '../utils/jsonKeyExtractor';
import { extractReturnKeys } from '../utils/jsKeyExtractor';
import { getRequestOutputPorts } from '../utils/requestOutputResolver';
import { useConnectionDrag } from './StitchConnectionDragContext';

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-600 text-white',
  POST: 'bg-blue-600 text-white',
  PUT: 'bg-orange-500 text-white',
  PATCH: 'bg-yellow-600 text-white',
  DELETE: 'bg-red-600 text-white',
  HEAD: 'bg-gray-500 text-white',
  OPTIONS: 'bg-gray-500 text-white',
};

const NODE_ICONS: Record<NodeType, React.ReactNode> = {
  'request': <Send size={12} />,
  'js-snippet': <Code size={12} />,
  'json-object': <Braces size={12} />,
  'sleep': <Timer size={12} />,
};

const NODE_COLORS: Record<NodeType, string> = {
  'request': 'bg-app-main/95 border-blue-500/40',
  'js-snippet': 'bg-app-main/95 border-amber-500/40',
  'json-object': 'bg-app-main/95 border-green-500/40',
  'sleep': 'bg-app-main/95 border-purple-500/40',
};

const NODE_HEADER_COLORS: Record<NodeType, string> = {
  'request': 'bg-blue-500/15',
  'js-snippet': 'bg-amber-500/15',
  'json-object': 'bg-green-500/15',
  'sleep': 'bg-purple-500/15',
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
  onConnectionDrop?: (targetNodeId: string) => void;
}

const NODE_WIDTH = 180;

export const StitchNode = React.memo(function StitchNode({
  node,
  selected,
  zoom,
  onSelect,
  onUpdatePosition,
  onUpdateLabel,
  onDelete,
  onConnectionDrop,
}: StitchNodeProps): React.ReactElement {
  const { drag, startDrag, updateCursor, endDrag } = useConnectionDrag();
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

  const portResult = useMemo(() => {
    if (node.type === 'json-object') {
      const jsonStr = (node.config as { json?: string }).json ?? '';
      return extractJsonKeys(jsonStr);
    }
    if (node.type === 'js-snippet') {
      const code = (node.config as { code?: string }).code ?? '';
      return extractReturnKeys(code);
    }
    if (node.type === 'request') {
      return { keys: getRequestOutputPorts(), error: null };
    }
    return null;
  }, [node.type, node.config]);

  const outputKeys = portResult?.keys ?? [];
  const hasError = portResult !== null && portResult.error !== null;
  const hasDynamicPorts = node.type === 'json-object' || node.type === 'js-snippet' || node.type === 'request';
  const portColor = node.type === 'js-snippet' ? 'amber' : node.type === 'request' ? 'blue' : 'green';

  const requestConfig = node.type === 'request' ? node.config as { method?: string; url?: string } : null;

  const sleepSummary = useMemo((): string | null => {
    if (node.type !== 'sleep') return null;
    const cfg = node.config as { mode?: string; durationMs?: number; minMs?: number; maxMs?: number };
    if (cfg.mode === 'random') return `${cfg.minMs ?? 500}–${cfg.maxMs ?? 2000}ms`;
    return `${cfg.durationMs ?? 1000}ms`;
  }, [node.type, node.config]);

  const handlePortPointerDown = useCallback((key: string, e: PointerEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    e.preventDefault();
    const allKeys = portResult?.keys ?? [];
    const idx = allKeys.indexOf(key);
    const count = allKeys.length;
    const offset = count === 1 ? 0.5 : idx / (count - 1);
    const leftPercent = (10 + offset * 80) / 100;
    const portX = node.positionX + NODE_WIDTH * leftPercent;
    const portY = node.positionY + 70;
    startDrag(node.id, key, portX, portY);

    const onMove = (ev: globalThis.PointerEvent): void => {
      const nodeEl = (e.target as HTMLElement).closest('[data-stitch-node]');
      if (!nodeEl) return;
      const rect = nodeEl.getBoundingClientRect();
      const scaleX = NODE_WIDTH / rect.width;
      const dx = (ev.clientX - e.clientX) * scaleX;
      const dy = (ev.clientY - e.clientY) * scaleX;
      updateCursor(portX + dx, portY + dy);
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      endDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [node.id, node.positionX, node.positionY, portResult, startDrag, updateCursor, endDrag]);

  const handleInputSlotPointerUp = useCallback((): void => {
    if (drag && drag.sourceNodeId !== node.id && onConnectionDrop) {
      onConnectionDrop(node.id);
    }
  }, [drag, node.id, onConnectionDrop]);

  const isDragTarget = drag !== null && drag.sourceNodeId !== node.id;
  const displayLabel = node.label || `${node.type}`;

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
      {/* Input port indicator (top) — drop target during drag */}
      <div
        className={`absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 bg-app-main transition-colors ${
          isDragTarget ? 'border-green-500 scale-150' : 'border-app-subtle'
        }`}
        onPointerUp={handleInputSlotPointerUp}
        data-testid="input-slot"
      />

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
        ) : requestConfig ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className={`rounded px-1 py-0.5 text-[8px] font-bold ${METHOD_COLORS[requestConfig.method ?? 'GET'] ?? METHOD_COLORS.GET}`} data-testid="method-badge">
                {requestConfig.method ?? 'GET'}
              </span>
            </div>
            {requestConfig.url ? (
              <span className="truncate text-[9px] text-app-muted" title={requestConfig.url} data-testid="url-preview">
                {requestConfig.url.slice(0, 40)}{requestConfig.url.length > 40 ? '...' : ''}
              </span>
            ) : (
              <span className="text-[9px] text-app-muted italic">No URL set</span>
            )}
          </div>
        ) : sleepSummary ? (
          <span className="text-[10px] font-mono text-purple-500" data-testid="sleep-summary">{sleepSummary}</span>
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
                className={`absolute -bottom-1.5 h-3 w-3 cursor-crosshair rounded-full border-2 bg-app-main ${portColor === 'amber' ? 'border-amber-500/50' : portColor === 'blue' ? 'border-blue-500/50' : 'border-green-500/50'} hover:scale-150 hover:border-blue-500 transition-transform`}
                style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                title={key}
                data-testid={`output-port-${key}`}
                onPointerDown={(e) => handlePortPointerDown(key, e)}
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

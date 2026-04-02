import React, { useState, useCallback, useRef, useMemo, type PointerEvent, type KeyboardEvent } from 'react';
import { Eye, AlertCircle } from 'lucide-react';
import type { StitchNode as StitchNodeType, StitchConnection, ExecutionNodeStatus } from '@/types/stitch';
import { useStitchStore } from '@/stores/stitchStore';
import { extractJsonKeys } from '../utils/jsonKeyExtractor';
import { extractReturnKeys } from '../utils/jsKeyExtractor';
import { getRequestOutputPorts } from '../utils/requestOutputResolver';
import { resolveInputShape } from '../utils/inputShapeResolver';
import { getNodeInputKeys } from '../utils/nodeOutputKeys';
import { useConnectionDrag } from './StitchConnectionDragContext';
import { METHOD_COLORS, NODE_ICONS, NODE_COLORS, NODE_HEADER_COLORS, NODE_WIDTH } from './StitchNode.constants';

interface StitchNodeProps {
  node: StitchNodeType;
  selected: boolean;
  zoom: number;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  onConnectionDrop?: (targetNodeId: string, targetSlot?: string) => void;
  onDragEnd?: (id: string) => void;
  connections?: StitchConnection[];
  executionStatus?: ExecutionNodeStatus | null;
}

export const StitchNode = React.memo(function StitchNode({
  node,
  selected,
  zoom,
  onSelect,
  onUpdatePosition,
  onUpdateLabel,
  onDelete,
  onConnectionDrop,
  onDragEnd,
  connections = [],
  executionStatus = null,
}: StitchNodeProps): React.ReactElement {
  const allNodes = useStitchStore((s) => s.nodes);
  const hasOutput = useStitchStore((s) => node.id in s.executionNodeOutputs);
  const isLoopEntry = node.type === 'js-snippet' && (node.config as { isLoopEntry?: boolean }).isLoopEntry === true;
  const { drag, startDrag, updateCursor, endDrag } = useConnectionDrag();
  const nodeRef = useRef<HTMLDivElement>(null);
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
    if (node.type === 'sleep') {
      const inputKeys = resolveInputShape(node.id, connections, allNodes);
      return inputKeys.length > 0 ? { keys: inputKeys, error: null } : null;
    }
    if (node.type === 'condition') {
      return { keys: ['true', 'false'], error: null };
    }
    if (node.type === 'mapping-entry') {
      return { keys: ['status', 'headers', 'body', 'cookies'], error: null };
    }
    return null;
  }, [node.type, node.config, node.id, connections, allNodes]);

  const outputKeys = portResult?.keys ?? [];
  const hasError = portResult !== null && portResult.error !== null;
  // JSON Object, JS Snippet, and Sleep use a single output port (full payload); Request keeps per-key ports
  const useSinglePort = node.type === 'json-object' || node.type === 'js-snippet' || node.type === 'sleep';
  const hasDynamicPorts = !useSinglePort && outputKeys.length > 0;
  const portColor = node.type === 'js-snippet' ? 'amber' : node.type === 'request' ? 'blue' : node.type === 'sleep' ? 'purple' : node.type === 'condition' ? 'amber' : node.type === 'mapping-entry' ? 'blue' : 'green';

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
    let portX: number;
    if (key === '__output__') {
      // Single centered port
      portX = node.positionX + NODE_WIDTH / 2;
    } else {
      const allKeys = portResult?.keys ?? [];
      const idx = allKeys.indexOf(key);
      const count = allKeys.length;
      const offset = count === 1 ? 0.5 : idx / (count - 1);
      const leftPercent = (10 + offset * 80) / 100;
      portX = node.positionX + NODE_WIDTH * leftPercent;
    }
    const measuredHeight = nodeRef.current?.offsetHeight ?? 82;
    const portY = node.positionY + measuredHeight;
    startDrag(node.id, key, portX, portY);

    const onMove = (ev: globalThis.PointerEvent): void => {
      // Convert screen-space delta to canvas-space using zoom (zoom === NODE_WIDTH / renderedWidth)
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
  }, [node.id, node.positionX, node.positionY, portResult, startDrag, updateCursor, endDrag]);

  const inputKeys = useMemo(() => getNodeInputKeys(node), [node.type]);

  const handleInputSlotPointerUp = useCallback((targetSlot?: string): void => {
    if (drag && drag.sourceNodeId !== node.id && onConnectionDrop) {
      onConnectionDrop(node.id, targetSlot);
    }
  }, [drag, node.id, onConnectionDrop]);

  const isDragTarget = drag !== null && drag.sourceNodeId !== node.id;
  const displayLabel = node.label || `${node.type}`;

  return (
    <div
      ref={nodeRef}
      data-stitch-node
      data-testid={`stitch-node-${node.id}`}
      data-node-id={node.id}
      tabIndex={0}
      className={`absolute select-none rounded-lg border shadow-sm transition-shadow ${isLoopEntry ? NODE_COLORS['loop'] : NODE_COLORS[node.type]} ${
        selected ? 'ring-2 ring-blue-500 shadow-md' : ''
      } ${dragging ? 'opacity-75' : ''} ${
        executionStatus === 'running' ? 'stitch-node-running' : ''
      } ${executionStatus === 'success' ? 'stitch-node-success' : ''} ${
        executionStatus === 'error' ? 'stitch-node-error' : ''
      }`}
      style={{
        left: node.positionX,
        top: node.positionY,
        width: 180,
        minHeight: 70,
      }}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      {/* Input port(s) — named for exit node, hidden for entry node, single slot for others */}
      {node.type === 'mapping-entry' ? null : inputKeys.length > 0 ? (
        <>
          {/* Named input port labels */}
          <div className="absolute -top-4 flex w-full justify-around px-1">
            {inputKeys.map((key) => (
              <span key={key} className="max-w-[3rem] truncate text-center text-[7px] leading-none text-app-muted">{key}</span>
            ))}
          </div>
          {/* Named input ports */}
          {inputKeys.map((key, i) => {
            const offset = inputKeys.length === 1 ? 0.5 : i / (inputKeys.length - 1);
            const leftPercent = 10 + offset * 80;
            return (
              <div
                key={key}
                className={`absolute -top-1.5 h-3 w-3 rounded-full border-2 bg-app-main transition-colors ${
                  isDragTarget ? 'border-green-500 scale-150' : 'border-yellow-500/50'
                }`}
                style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                title={key}
                onPointerUp={() => handleInputSlotPointerUp(key)}
                data-testid={`input-slot-${key}`}
              />
            );
          })}
        </>
      ) : (
        <div
          className={`absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 bg-app-main transition-colors ${
            isDragTarget ? 'border-green-500 scale-150' : 'border-app-subtle'
          }`}
          onPointerUp={() => handleInputSlotPointerUp()}
          data-testid="input-slot"
        />
      )}

      {/* Title bar — drag handle */}
      <div
        className={`flex cursor-grab items-center gap-1.5 rounded-t-lg px-2 py-1.5 ${isLoopEntry ? NODE_HEADER_COLORS['loop'] : NODE_HEADER_COLORS[node.type]} ${dragging ? 'cursor-grabbing' : ''}`}
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
          className={`transition-opacity ${hasOutput ? 'text-app-muted hover:text-app-secondary' : 'text-app-muted/30 cursor-default'}`}
          title={hasOutput ? 'Preview last output' : 'No results'}
          onClick={(e) => {
            e.stopPropagation();
            if (!hasOutput) return;
            const store = useStitchStore.getState();
            if (store.previewNodeId === node.id && store.bottomPanel === 'preview') {
              // Toggle: switch back to editor mode
              useStitchStore.setState({ previewNodeId: null, bottomPanel: 'none', selectedNodeId: node.id });
            } else {
              store.setPreviewNode(node.id);
            }
          }}
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
              <div className="stitch-marquee-container overflow-hidden" title={requestConfig.url} data-testid="url-preview">
                <span className={`inline-block whitespace-nowrap text-[9px] text-app-muted ${requestConfig.url.length > 24 ? 'stitch-marquee' : ''}`}>
                  {requestConfig.url}
                </span>
              </div>
            ) : (
              <span className="text-[9px] text-app-muted italic">No URL set</span>
            )}
          </div>
        ) : sleepSummary ? (
          <span className="text-[10px] font-mono text-purple-500" data-testid="sleep-summary">{sleepSummary}</span>
        ) : outputKeys.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {outputKeys.map((key) => (
              <span key={key} className={`rounded px-1 py-0.5 text-[9px] ${portColor === 'amber' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : portColor === 'blue' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400' : portColor === 'purple' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400' : 'bg-green-500/15 text-green-700 dark:text-green-400'}`} data-testid={`port-${key}`}>
                {key}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-app-muted">{node.type}</span>
        )}
      </div>

      {/* Output port labels */}
      {hasDynamicPorts && !hasError && outputKeys.length > 0 && (
        <div className="flex justify-around px-1 pb-1">
          {outputKeys.map((key) => (
            <span key={key} className="max-w-[3rem] truncate text-center text-[7px] leading-none text-app-muted">{key}</span>
          ))}
        </div>
      )}

      {/* Output ports — mapping-exit is terminal, no output port needed */}
      {node.type === 'mapping-exit' ? null : hasDynamicPorts && !hasError && outputKeys.length > 0 ? (
        <div className="relative h-3">
          {outputKeys.map((key, i) => {
            const offset = outputKeys.length === 1 ? 0.5 : i / (outputKeys.length - 1);
            const leftPercent = 10 + offset * 80;
            return (
              <div
                key={key}
                className={`absolute -bottom-1.5 h-3 w-3 cursor-crosshair rounded-full border-2 bg-app-main ${portColor === 'amber' ? 'border-amber-500/50' : portColor === 'blue' ? 'border-blue-500/50' : portColor === 'purple' ? 'border-purple-500/50' : 'border-green-500/50'} hover:scale-150 hover:border-blue-500 transition-transform`}
                style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                title={key}
                data-testid={`output-port-${key}`}
                onPointerDown={(e) => handlePortPointerDown(key, e)}
              />
            );
          })}
        </div>
      ) : (
        <div
          className={`absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 bg-app-main transition-transform ${
            useSinglePort && !hasError
              ? `cursor-crosshair ${portColor === 'amber' ? 'border-amber-500/50' : portColor === 'purple' ? 'border-purple-500/50' : portColor === 'green' ? 'border-green-500/50' : 'border-app-subtle'} hover:scale-150 hover:border-blue-500`
              : 'border-app-subtle'
          }`}
          data-testid="output-port-single"
          onPointerDown={useSinglePort && !hasError ? (e) => handlePortPointerDown('__output__', e) : undefined}
        />
      )}
    </div>
  );
});

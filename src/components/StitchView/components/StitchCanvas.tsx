import { useCallback, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Play, Square, ScrollText, Send, Code, Braces, Timer } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { useCanvasTransform } from './StitchCanvas.hooks';
import { StitchNode } from './StitchNode';
import { AddNodeMenu } from './AddNodeMenu';
import { ConnectionLayer } from './ConnectionLayer';
import { StitchConnectionDragProvider, useConnectionDrag } from './StitchConnectionDragContext';
import { validateConnection } from '../utils/connectionValidator';
import type { StitchNodeType } from '@/types/stitch';
import { DEFAULT_JSON_OBJECT_CONFIG, DEFAULT_JS_SNIPPET_CONFIG, DEFAULT_REQUEST_NODE_CONFIG, DEFAULT_SLEEP_NODE_CONFIG } from '@/types/stitch';

export function StitchCanvas(): React.ReactElement {
  return (
    <StitchConnectionDragProvider>
      <StitchCanvasInner />
    </StitchConnectionDragProvider>
  );
}

function StitchCanvasInner(): React.ReactElement {
  const nodes = useStitchStore((s) => s.nodes);
  const connections = useStitchStore((s) => s.connections);
  const selectedNodeId = useStitchStore((s) => s.selectedNodeId);
  const selectNode = useStitchStore((s) => s.selectNode);
  const addNode = useStitchStore((s) => s.addNode);
  const updateNode = useStitchStore((s) => s.updateNode);
  const removeNode = useStitchStore((s) => s.removeNode);
  const addConnection = useStitchStore((s) => s.addConnection);
  const activeChainId = useStitchStore((s) => s.activeChainId);
  const selectConnection = useStitchStore((s) => s.selectConnection);
  const selectedConnectionId = useStitchStore((s) => s.selectedConnectionId);
  const removeConnection = useStitchStore((s) => s.removeConnection);
  const executionState = useStitchStore((s) => s.executionState);
  const startExecution = useStitchStore((s) => s.startExecution);
  const cancelExecution = useStitchStore((s) => s.cancelExecution);
  const executionCurrentNodeId = useStitchStore((s) => s.executionCurrentNodeId);
  const executionNodeOutputs = useStitchStore((s) => s.executionNodeOutputs);
  const executionError = useStitchStore((s) => s.executionError);
  const executionLogs = useStitchStore((s) => s.executionLogs);
  const { drag } = useConnectionDrag();

  const { transform, canvasRef, onPointerDown, onPointerMove, onPointerUp, zoomIn, zoomOut, zoomReset } =
    useCanvasTransform();

  const handlePlay = useCallback((): void => {
    // Deselect node so the debug log panel is visible
    selectNode(null);
    startExecution().catch((err) => {
      console.error('[stitch] Execution failed:', err);
    });
  }, [startExecution, selectNode]);

  const handleStop = useCallback((): void => {
    cancelExecution();
  }, [cancelExecution]);

  const canPlay = nodes.length > 0 && executionState !== 'running';
  const isRunning = executionState === 'running';
  const hasLogs = executionLogs.length > 0;
  // Show the "open log" button when there are results but the debug panel isn't visible
  // (because a node is selected, showing the editor instead)
  const showOpenLog = hasLogs && !isRunning && selectedNodeId !== null;

  const handleOpenLog = useCallback((): void => {
    selectNode(null);
  }, [selectNode]);

  const handleCanvasClick = useCallback((e: React.MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[data-stitch-node]')) return;
    // Don't deselect when clicking on SVG connection lines
    if ((e.target as HTMLElement).closest('svg')) return;
    selectNode(null);
    selectConnection(null);
  }, [selectNode, selectConnection]);

  const handleConnectionDrop = useCallback(
    (targetNodeId: string): void => {
      if (!drag || !activeChainId) return;
      const result = validateConnection(drag.sourceNodeId, drag.sourceKey, targetNodeId, connections);
      if (!result.valid) return;
      addConnection({
        chainId: activeChainId,
        sourceNodeId: drag.sourceNodeId,
        sourceKey: drag.sourceKey,
        targetNodeId,
        targetSlot: 'input',
      }).catch(() => {});
    },
    [drag, activeChainId, connections, addConnection],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedConnectionId) {
        e.preventDefault();
        removeConnection(selectedConnectionId).catch(() => {});
      }
    },
    [selectedConnectionId, removeConnection],
  );

  const handleUpdatePosition = useCallback(
    (id: string, x: number, y: number): void => {
      updateNode(id, { positionX: x, positionY: y }).catch(() => {});
    },
    [updateNode],
  );

  const handleUpdateLabel = useCallback(
    (id: string, label: string): void => {
      updateNode(id, { label }).catch(() => {});
    },
    [updateNode],
  );

  const handleDelete = useCallback(
    (id: string): void => {
      removeNode(id).catch(() => {});
    },
    [removeNode],
  );

  const handleAddNode = useCallback(
    (type: StitchNodeType): void => {
      if (!activeChainId) return;
      const existingOfType = nodes.filter((n) => n.type === type).length;
      const label = `${type === 'js-snippet' ? 'Snippet' : type === 'json-object' ? 'JSON' : type === 'sleep' ? 'Sleep' : 'Request'} ${existingOfType + 1}`;
      const centerX = (-transform.panX + 300) / transform.zoom;
      const centerY = (-transform.panY + 200) / transform.zoom;
      const config = type === 'json-object' ? { ...DEFAULT_JSON_OBJECT_CONFIG }
        : type === 'js-snippet' ? { ...DEFAULT_JS_SNIPPET_CONFIG }
        : type === 'request' ? { ...DEFAULT_REQUEST_NODE_CONFIG }
        : type === 'sleep' ? { ...DEFAULT_SLEEP_NODE_CONFIG }
        : {};
      addNode({
        chainId: activeChainId,
        type,
        positionX: centerX,
        positionY: centerY,
        config,
        label,
      }).catch(() => {});
    },
    [activeChainId, nodes, addNode, transform],
  );

  // ─── Canvas context menu ───────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent): void => {
    // Only show on empty canvas, not on nodes
    if ((e.target as HTMLElement).closest('[data-stitch-node]')) return;
    e.preventDefault();
    const canvasX = (e.nativeEvent.offsetX - transform.panX) / transform.zoom;
    const canvasY = (e.nativeEvent.offsetY - transform.panY) / transform.zoom;
    setContextMenu({ x: e.clientX, y: e.clientY, canvasX, canvasY });
  }, [transform]);

  const handleContextAdd = useCallback((type: StitchNodeType): void => {
    if (!activeChainId || !contextMenu) return;
    const existingOfType = nodes.filter((n) => n.type === type).length;
    const label = `${type === 'js-snippet' ? 'Snippet' : type === 'json-object' ? 'JSON' : type === 'sleep' ? 'Sleep' : 'Request'} ${existingOfType + 1}`;
    const config = type === 'json-object' ? { ...DEFAULT_JSON_OBJECT_CONFIG }
      : type === 'js-snippet' ? { ...DEFAULT_JS_SNIPPET_CONFIG }
      : type === 'request' ? { ...DEFAULT_REQUEST_NODE_CONFIG }
      : type === 'sleep' ? { ...DEFAULT_SLEEP_NODE_CONFIG }
      : {};
    addNode({
      chainId: activeChainId,
      type,
      positionX: contextMenu.canvasX,
      positionY: contextMenu.canvasY,
      config,
      label,
    }).catch(() => {});
    setContextMenu(null);
  }, [activeChainId, nodes, addNode, contextMenu]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent): void => {
    setContextMenu(null);
    onPointerDown(e);
  }, [onPointerDown]);

  const zoomPercent = Math.round(transform.zoom * 100);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center gap-2 border-b border-app-subtle bg-app-sidebar px-3 py-1.5"
        data-stitch-toolbar
      >
        <AddNodeMenu onAddNode={handleAddNode} />
        <div className="mx-1 h-4 w-px bg-app-subtle" />
        {isRunning ? (
          <button
            className="rounded p-1 text-red-400 hover:bg-red-500/20"
            onClick={handleStop}
            title="Stop execution"
            data-testid="stitch-stop-btn"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            className={`rounded p-1 ${canPlay ? 'text-green-400 hover:bg-green-500/20' : 'cursor-not-allowed text-app-muted opacity-40'}`}
            onClick={canPlay ? handlePlay : undefined}
            disabled={!canPlay}
            title="Run chain"
            data-testid="stitch-play-btn"
          >
            <Play size={14} />
          </button>
        )}
        {showOpenLog && (
          <button
            className="rounded p-1 text-blue-400 hover:bg-blue-500/20"
            onClick={handleOpenLog}
            title="Show debug log"
            data-testid="stitch-open-log-btn"
          >
            <ScrollText size={14} />
          </button>
        )}
        <div className="flex-1" />
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Beta
        </span>
        <div className="mx-1 h-4 w-px bg-app-subtle" />
        <button
          className="rounded p-1 text-app-muted hover:bg-app-hover hover:text-app-secondary"
          onClick={zoomOut}
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <span className="min-w-[3rem] text-center text-xs text-app-muted">{zoomPercent}%</span>
        <button
          className="rounded p-1 text-app-muted hover:bg-app-hover hover:text-app-secondary"
          onClick={zoomIn}
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="rounded p-1 text-app-muted hover:bg-app-hover hover:text-app-secondary"
          onClick={zoomReset}
          title="Reset zoom"
        >
          <Maximize size={14} />
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={canvasRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="relative flex-1 cursor-grab overflow-hidden bg-app-main outline-none active:cursor-grabbing"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--app-border-subtle) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
        data-testid="stitch-canvas"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
      >
        <div
          style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            inset: 0,
          }}
        >
          <ConnectionLayer />
          {nodes.map((node) => {
            const nodeExecStatus = executionError?.nodeId === node.id
              ? 'error' as const
              : executionCurrentNodeId === node.id
                ? 'running' as const
                : node.id in executionNodeOutputs
                  ? 'success' as const
                  : null;
            return (
              <StitchNode
                key={node.id}
                node={node}
                selected={node.id === selectedNodeId}
                zoom={transform.zoom}
                onSelect={selectNode}
                onUpdatePosition={handleUpdatePosition}
                onUpdateLabel={handleUpdateLabel}
                onDelete={handleDelete}
                onConnectionDrop={handleConnectionDrop}
                connections={connections}
                executionStatus={nodeExecStatus}
              />
            );
          })}
        </div>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-app-muted">Empty canvas</p>
              <p className="mt-1 text-xs text-app-muted">
                Right-click or use "Add Node" to get started
              </p>
            </div>
          </div>
        )}

        {/* Context menu */}
        {contextMenu && (
          <div
            className="fixed z-50 min-w-[140px] rounded border border-app-subtle bg-app-main shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            data-testid="canvas-context-menu"
          >
            {([
              { type: 'request' as const, label: 'Request', icon: <Send size={14} /> },
              { type: 'js-snippet' as const, label: 'JS Snippet', icon: <Code size={14} /> },
              { type: 'json-object' as const, label: 'JSON Object', icon: <Braces size={14} /> },
              { type: 'sleep' as const, label: 'Sleep', icon: <Timer size={14} /> },
            ]).map((opt) => (
              <button
                key={opt.type}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-app-secondary hover:bg-app-hover"
                onClick={() => handleContextAdd(opt.type)}
                data-testid={`context-add-${opt.type}`}
              >
                <span className="text-app-muted">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

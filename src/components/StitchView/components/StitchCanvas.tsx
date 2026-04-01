import { useCallback, useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize, Play, Square, ScrollText, FileOutput, Send, Code, Braces, Timer, Repeat, GitMerge, GitBranch } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { useCanvasTransform } from './StitchCanvas.hooks';
import { StitchNode } from './StitchNode';
import { StitchLoopNode, LOOP_MAX_CHILDREN } from './StitchLoopNode';
import { StitchMappingNode } from './StitchMappingNode';
import { AddNodeMenu } from './AddNodeMenu';
import { ConnectionLayer } from './ConnectionLayer';
import { StitchConnectionDragProvider, useConnectionDrag } from './StitchConnectionDragContext';
import { validateConnection } from '../utils/connectionValidator';
import { computeLoopChildPositions } from '../utils/loopLayout';
import type { StitchNodeType } from '@/types/stitch';
import { DEFAULT_JSON_OBJECT_CONFIG, DEFAULT_JS_SNIPPET_CONFIG, DEFAULT_REQUEST_NODE_CONFIG, DEFAULT_SLEEP_NODE_CONFIG, DEFAULT_LOOP_NODE_CONFIG, DEFAULT_MERGE_NODE_CONFIG, DEFAULT_CONDITION_NODE_CONFIG, DEFAULT_MAPPING_CONFIG, DEFAULT_MAPPING_ENTRY_CONFIG, DEFAULT_MAPPING_EXIT_CONFIG } from '@/types/stitch';
import { computeMappingChildPositions } from '../utils/mappingLayout';

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
  const chains = useStitchStore((s) => s.chains);
  const isMapperChain = chains.find((c) => c.id === activeChainId)?.mappingId != null;
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
  const { drag, consumeDroppedDrag } = useConnectionDrag();
  const connectionMadeRef = useRef(false);

  const { transform, canvasRef, onPointerDown, onPointerMove, onPointerUp, zoomIn, zoomOut, zoomReset, frameAll } =
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

  const bottomPanel = useStitchStore((s) => s.bottomPanel);
  const canPlay = nodes.length > 0 && executionState !== 'running';
  const isRunning = executionState === 'running';
  const hasLogs = executionLogs.length > 0;
  const hasOutputs = Object.keys(useStitchStore.getState().executionNodeOutputs).length > 0;

  const handleOpenLog = useCallback((): void => {
    selectNode(null);
    useStitchStore.setState({ bottomPanel: 'debug' });
  }, [selectNode]);

  const handleOpenOutput = useCallback((): void => {
    selectNode(null);
    useStitchStore.setState({ bottomPanel: 'output' });
  }, [selectNode]);

  const handleCanvasClick = useCallback((e: React.MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[data-stitch-node]')) return;
    // Don't deselect when clicking on SVG connection lines
    if ((e.target as HTMLElement).closest('svg')) return;
    selectNode(null);
    selectConnection(null);
  }, [selectNode, selectConnection]);

  const handleConnectionDrop = useCallback(
    async (targetNodeId: string, targetSlot?: string): Promise<void> => {
      if (!drag || !activeChainId) return;
      const sourceKey = drag.sourceKey === '__output__' ? null : drag.sourceKey;
      const slot = targetSlot ?? 'input';

      // Exit node: disconnect existing incoming connection to this port before rewiring
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      if (targetNode?.type === 'mapping-exit' && slot && slot !== 'input') {
        const existing = connections.find(
          (c) => c.targetNodeId === targetNodeId && c.targetSlot === slot,
        );
        if (existing) await removeConnection(existing.id).catch(() => {});
      }

      const result = validateConnection(drag.sourceNodeId, sourceKey, targetNodeId, connections);
      if (!result.valid) return;
      connectionMadeRef.current = true;
      addConnection({
        chainId: activeChainId,
        sourceNodeId: drag.sourceNodeId,
        sourceKey,
        targetNodeId,
        targetSlot: slot,
      }).catch(() => {});
    },
    [drag, activeChainId, connections, nodes, addConnection, removeConnection],
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

  const rebalanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending rebalance when switching chains
  useEffect(() => {
    return () => { if (rebalanceTimerRef.current) clearTimeout(rebalanceTimerRef.current); };
  }, [activeChainId]);

  const rebalanceLoop = useCallback(
    (loopNodeId: string): void => {
      const freshNodes = useStitchStore.getState().nodes;
      const freshConns = useStitchStore.getState().connections;
      const loopNode = freshNodes.find((n) => n.id === loopNodeId);
      if (!loopNode) return;
      const children = freshNodes.filter((n) => n.parentNodeId === loopNodeId);
      const positions = computeLoopChildPositions(loopNode, children, freshConns);
      for (const [childId, pos] of positions) {
        updateNode(childId, { positionX: pos.x, positionY: pos.y }).catch(() => {});
      }
    },
    [updateNode],
  );

  const rebalanceMapping = useCallback(
    (mappingNodeId: string): void => {
      const freshNodes = useStitchStore.getState().nodes;
      const freshConns = useStitchStore.getState().connections;
      const mappingNode = freshNodes.find((n) => n.id === mappingNodeId);
      if (!mappingNode) return;
      const children = freshNodes.filter((n) => n.parentNodeId === mappingNodeId);
      const positions = computeMappingChildPositions(mappingNode, children, freshConns);
      for (const [childId, pos] of positions) {
        updateNode(childId, { positionX: pos.x, positionY: pos.y }).catch(() => {});
      }
    },
    [updateNode],
  );

  const handleUpdatePosition = useCallback(
    (id: string, x: number, y: number): void => {
      // Read fresh state so children move correctly on every tick
      const freshNodes = useStitchStore.getState().nodes;
      const movedNode = freshNodes.find((n) => n.id === id);

      if (movedNode?.type === 'loop' || movedNode?.type === 'mapping') {
        const dx = x - movedNode.positionX;
        const dy = y - movedNode.positionY;
        const children = freshNodes.filter((n) => n.parentNodeId === id);
        for (const child of children) {
          updateNode(child.id, { positionX: child.positionX + dx, positionY: child.positionY + dy }).catch(() => {});
        }
        if (rebalanceTimerRef.current) clearTimeout(rebalanceTimerRef.current);
        const rebalanceFn = movedNode.type === 'mapping' ? rebalanceMapping : rebalanceLoop;
        rebalanceTimerRef.current = setTimeout(() => rebalanceFn(id), 200);
      }

      updateNode(id, { positionX: x, positionY: y }).catch(() => {});
    },
    [updateNode, rebalanceLoop, rebalanceMapping],
  );

  // Check loop/mapping containment after a node drag ends
  const handleNodeDragEnd = useCallback(
    (id: string): void => {
      const movedNode = nodes.find((n) => n.id === id);
      if (!movedNode || movedNode.type === 'loop' || movedNode.type === 'mapping') return;

      const containerNodes = nodes.filter((n) => (n.type === 'loop' || n.type === 'mapping') && n.id !== id);
      let newParent: string | null = null;
      for (const container of containerNodes) {
        // Loop has child limit, mapping doesn't
        if (container.type === 'loop') {
          const childCount = nodes.filter((n) => n.parentNodeId === container.id && n.id !== id).length;
          if (childCount >= LOOP_MAX_CHILDREN) continue;
        }

        const el = document.querySelector(`[data-node-id="${container.id}"]`) as HTMLElement | null;
        const cW = el?.offsetWidth ?? 240;
        const cH = el?.offsetHeight ?? 152;
        if (movedNode.positionX >= container.positionX &&
            movedNode.positionX + 180 <= container.positionX + cW &&
            movedNode.positionY >= container.positionY + 32 &&
            movedNode.positionY + 70 <= container.positionY + cH) {
          newParent = container.id;
          break;
        }
      }

      if (newParent !== movedNode.parentNodeId) {
        updateNode(id, { parentNodeId: newParent }).then(() => {
          const parentNode = nodes.find((n) => n.id === newParent);
          const rebalanceFn = parentNode?.type === 'mapping' ? rebalanceMapping : rebalanceLoop;
          if (newParent) rebalanceFn(newParent);
          if (movedNode.parentNodeId) {
            const oldParent = nodes.find((n) => n.id === movedNode.parentNodeId);
            const oldRebalance = oldParent?.type === 'mapping' ? rebalanceMapping : rebalanceLoop;
            oldRebalance(movedNode.parentNodeId);
          }
        }).catch(() => {});
      }
    },
    [updateNode, nodes, rebalanceLoop, rebalanceMapping],
  );

  const handleUpdateLabel = useCallback(
    (id: string, label: string): void => {
      updateNode(id, { label }).catch(() => {});
    },
    [updateNode],
  );

  const handleDelete = useCallback(
    (id: string): void => {
      const nodeToDelete = nodes.find((n) => n.id === id);
      if (nodeToDelete?.type === 'js-snippet') {
        const cfg = nodeToDelete.config as { isLoopEntry?: boolean };
        if (cfg.isLoopEntry) return; // Can't delete loop entry snippet
      }
      // Can't delete mapping entry/exit nodes individually
      if (nodeToDelete?.type === 'mapping-entry' || nodeToDelete?.type === 'mapping-exit') return;
      // Can't delete the mapping container in mapper-bound chains
      if (isMapperChain && nodeToDelete?.type === 'mapping') return;
      // Delete children first if deleting a container node (loop or mapping)
      if (nodeToDelete?.type === 'loop' || nodeToDelete?.type === 'mapping') {
        const children = nodes.filter((n) => n.parentNodeId === id);
        for (const child of children) {
          removeNode(child.id).catch(() => {});
        }
      }
      removeNode(id).catch(() => {});
    },
    [removeNode, nodes, isMapperChain],
  );

  const createMappingChildren = useCallback(
    (mappingNodeId: string): void => {
      if (!activeChainId) return;
      const entryPromise = addNode({
        chainId: activeChainId,
        type: 'mapping-entry',
        positionX: 0,
        positionY: 0,
        config: { ...DEFAULT_MAPPING_ENTRY_CONFIG },
        label: 'Entry',
        parentNodeId: mappingNodeId,
      });
      const exitPromise = addNode({
        chainId: activeChainId,
        type: 'mapping-exit',
        positionX: 0,
        positionY: 0,
        config: { ...DEFAULT_MAPPING_EXIT_CONFIG },
        label: 'Exit',
        parentNodeId: mappingNodeId,
      });
      Promise.all([entryPromise, exitPromise]).then(async ([entry, exit]) => {
        // Create one connection per output key from entry → exit (keyed input ports)
        for (const key of ['status', 'headers', 'body', 'cookies']) {
          await addConnection({
            chainId: activeChainId,
            sourceNodeId: entry.id,
            sourceKey: key,
            targetNodeId: exit.id,
            targetSlot: key,
          }).catch(() => {});
        }
        rebalanceMapping(mappingNodeId);
      }).catch(() => {});
    },
    [activeChainId, addNode, addConnection, rebalanceMapping],
  );

  const createLoopEntrySnippet = useCallback(
    (loopNodeId: string): void => {
      if (!activeChainId) return;
      addNode({
        chainId: activeChainId,
        type: 'js-snippet',
        positionX: 0,
        positionY: 0,
        config: {
          code: '// Entry point — receives { element, index } per iteration\nconst { element, index } = input;\nreturn { element, index };\n',
          isLoopEntry: true,
        },
        label: 'Entry',
        parentNodeId: loopNodeId,
      }).then(() => rebalanceLoop(loopNodeId)).catch(() => {});
    },
    [activeChainId, addNode, rebalanceLoop],
  );

  const handleAddNode = useCallback(
    (type: StitchNodeType): void => {
      if (!activeChainId || isMapperChain) return;
      const existingOfType = nodes.filter((n) => n.type === type).length;
      const labelMap: Record<string, string> = { 'js-snippet': 'Snippet', 'json-object': 'JSON', sleep: 'Sleep', loop: 'Loop', request: 'Request', merge: 'Merge', condition: 'Condition', mapping: 'Mapping' };
      const label = `${labelMap[type] ?? type} ${existingOfType + 1}`;
      const centerX = (-transform.panX + 300) / transform.zoom;
      const centerY = (-transform.panY + 200) / transform.zoom;
      const config = type === 'json-object' ? { ...DEFAULT_JSON_OBJECT_CONFIG }
        : type === 'js-snippet' ? { ...DEFAULT_JS_SNIPPET_CONFIG }
        : type === 'request' ? { ...DEFAULT_REQUEST_NODE_CONFIG }
        : type === 'sleep' ? { ...DEFAULT_SLEEP_NODE_CONFIG }
        : type === 'loop' ? { ...DEFAULT_LOOP_NODE_CONFIG }
        : type === 'merge' ? { ...DEFAULT_MERGE_NODE_CONFIG }
        : type === 'condition' ? { ...DEFAULT_CONDITION_NODE_CONFIG }
        : type === 'mapping' ? { ...DEFAULT_MAPPING_CONFIG }
        : {};
      addNode({
        chainId: activeChainId,
        type,
        positionX: centerX,
        positionY: centerY,
        config,
        label,
        parentNodeId: null,
      }).then((newNode) => {
        if (type === 'loop') createLoopEntrySnippet(newNode.id);
        if (type === 'mapping') createMappingChildren(newNode.id);
      }).catch((err) => { console.error('[stitch] addNode failed:', err); });
    },
    [activeChainId, isMapperChain, nodes, addNode, transform, createLoopEntrySnippet, createMappingChildren],
  );

  // ─── Canvas context menu ───────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; canvasX: number; canvasY: number;
    pendingSource?: { nodeId: string; sourceKey: string | null; parentNodeId: string | null };
  } | null>(null);

  // Detect drag-drop on empty space → show context menu to create + connect
  useEffect(() => {
    if (drag !== null) {
      connectionMadeRef.current = false;
      return;
    }
    // drag just became null — check if it was dropped on empty space
    const dropped = consumeDroppedDrag();
    if (!dropped || connectionMadeRef.current) return;

    const sourceNode = nodes.find((n) => n.id === dropped.sourceNodeId);

    // Mapper chains: only allow drag-drop context menu for nodes inside the container
    if (isMapperChain && !sourceNode?.parentNodeId) return;

    // Convert cursor canvas coords to screen coords for the menu position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = rect.left + dropped.cursorX * transform.zoom + transform.panX;
    const screenY = rect.top + dropped.cursorY * transform.zoom + transform.panY;
    const sourceKey = dropped.sourceKey === '__output__' ? null : dropped.sourceKey;

    setContextMenu({
      x: screenX,
      y: screenY,
      canvasX: dropped.cursorX,
      canvasY: dropped.cursorY,
      pendingSource: { nodeId: dropped.sourceNodeId, sourceKey, parentNodeId: sourceNode?.parentNodeId ?? null },
    });
  }, [drag, consumeDroppedDrag, transform, canvasRef, isMapperChain, nodes]);

  const handleContextMenu = useCallback((e: React.MouseEvent): void => {
    // Only show on empty canvas, not on nodes
    if ((e.target as HTMLElement).closest('[data-stitch-node]')) return;
    e.preventDefault();
    // Mapper chains don't allow adding nodes outside the container
    if (isMapperChain) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasX = (e.clientX - rect.left - transform.panX) / transform.zoom;
    const canvasY = (e.clientY - rect.top - transform.panY) / transform.zoom;
    setContextMenu({ x: e.clientX, y: e.clientY, canvasX, canvasY });
  }, [isMapperChain, transform, canvasRef]);

  const handleContextAdd = useCallback((type: StitchNodeType): void => {
    if (!activeChainId || !contextMenu) return;
    const existingOfType = nodes.filter((n) => n.type === type).length;
    const ctxLabelMap: Record<string, string> = { 'js-snippet': 'Snippet', 'json-object': 'JSON', sleep: 'Sleep', loop: 'Loop', request: 'Request', merge: 'Merge', condition: 'Condition', mapping: 'Mapping' };
    const label = `${ctxLabelMap[type] ?? type} ${existingOfType + 1}`;
    const config = type === 'json-object' ? { ...DEFAULT_JSON_OBJECT_CONFIG }
      : type === 'js-snippet' ? { ...DEFAULT_JS_SNIPPET_CONFIG }
      : type === 'request' ? { ...DEFAULT_REQUEST_NODE_CONFIG }
      : type === 'sleep' ? { ...DEFAULT_SLEEP_NODE_CONFIG }
      : type === 'loop' ? { ...DEFAULT_LOOP_NODE_CONFIG }
      : type === 'merge' ? { ...DEFAULT_MERGE_NODE_CONFIG }
      : type === 'condition' ? { ...DEFAULT_CONDITION_NODE_CONFIG }
      : type === 'mapping' ? { ...DEFAULT_MAPPING_CONFIG }
      : {};
    const pending = contextMenu.pendingSource;
    const inheritedParent = pending?.parentNodeId ?? null;
    // Don't allow creating container nodes inside other containers
    if ((type === 'loop' || type === 'mapping') && inheritedParent) return;
    addNode({
      chainId: activeChainId,
      type,
      positionX: contextMenu.canvasX,
      positionY: contextMenu.canvasY,
      config,
      label,
      parentNodeId: inheritedParent,
    }).then(async (newNode) => {
      if (pending) {
        await addConnection({
          chainId: activeChainId,
          sourceNodeId: pending.nodeId,
          sourceKey: pending.sourceKey,
          targetNodeId: newNode.id,
          targetSlot: 'input',
        }).catch(() => {});
      }
      if (type === 'loop') createLoopEntrySnippet(newNode.id);
      if (type === 'mapping') createMappingChildren(newNode.id);
      if (inheritedParent) rebalanceLoop(inheritedParent);
    }).catch(() => {});
    setContextMenu(null);
  }, [activeChainId, nodes, addNode, addConnection, contextMenu, createLoopEntrySnippet, createMappingChildren, rebalanceLoop]);

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
        <AddNodeMenu onAddNode={handleAddNode} disabled={isMapperChain} />
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
        {hasLogs && !isRunning && (
          <button
            className={`rounded p-1 ${bottomPanel === 'debug' ? 'bg-blue-500/20 text-blue-400' : 'text-app-muted hover:bg-blue-500/20 hover:text-blue-400'}`}
            onClick={handleOpenLog}
            title="Debug log"
            data-testid="stitch-open-log-btn"
          >
            <ScrollText size={14} />
          </button>
        )}
        {hasOutputs && !isRunning && (
          <button
            className={`rounded p-1 ${bottomPanel === 'output' ? 'bg-blue-500/20 text-blue-400' : 'text-app-muted hover:bg-blue-500/20 hover:text-blue-400'}`}
            onClick={handleOpenOutput}
            title="Chain output"
            data-testid="stitch-open-output-btn"
          >
            <FileOutput size={14} />
          </button>
        )}
        <div className="flex-1" />
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
          onClick={() => nodes.length > 0 ? frameAll(nodes) : zoomReset()}
          title="Frame all nodes"
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
          {/* Render loop nodes first (behind regular nodes) */}
          {nodes.filter((n) => n.type === 'loop').map((node) => {
            const nodeExecStatus = executionError?.nodeId === node.id
              ? 'error' as const
              : executionCurrentNodeId === node.id
                ? 'running' as const
                : node.id in executionNodeOutputs
                  ? 'success' as const
                  : null;
            const children = nodes.filter((n) => n.parentNodeId === node.id);
            return (
              <StitchLoopNode
                key={node.id}
                node={node}
                childNodes={children}
                selected={node.id === selectedNodeId}
                zoom={transform.zoom}
                onSelect={selectNode}
                onUpdatePosition={handleUpdatePosition}
                onUpdateLabel={handleUpdateLabel}
                onDelete={handleDelete}
                onConnectionDrop={handleConnectionDrop}
                executionStatus={nodeExecStatus}
                connections={connections}
              />
            );
          })}
          {/* Render mapping container nodes */}
          {nodes.filter((n) => n.type === 'mapping').map((node) => {
            const nodeExecStatus = executionError?.nodeId === node.id
              ? 'error' as const
              : executionCurrentNodeId === node.id
                ? 'running' as const
                : node.id in executionNodeOutputs
                  ? 'success' as const
                  : null;
            const children = nodes.filter((n) => n.parentNodeId === node.id);
            return (
              <StitchMappingNode
                key={node.id}
                node={node}
                childNodes={children}
                selected={node.id === selectedNodeId}
                zoom={transform.zoom}
                onSelect={selectNode}
                onUpdatePosition={handleUpdatePosition}
                onUpdateLabel={handleUpdateLabel}
                onDelete={handleDelete}
                onConnectionDrop={handleConnectionDrop}
                executionStatus={nodeExecStatus}
                connections={connections}
              />
            );
          })}
          {/* Render regular nodes (non-container) */}
          {nodes.filter((n) => n.type !== 'loop' && n.type !== 'mapping').map((node) => {
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
                onDragEnd={handleNodeDragEnd}
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
            className="fixed z-50 min-w-[140px] rounded border border-app-subtle bg-app-main py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            data-testid="canvas-context-menu"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {([
              { type: 'request' as const, label: 'Request', icon: <Send size={14} /> },
              { type: 'js-snippet' as const, label: 'JS Snippet', icon: <Code size={14} /> },
              { type: 'json-object' as const, label: 'JSON Object', icon: <Braces size={14} /> },
              { type: 'sleep' as const, label: 'Sleep', icon: <Timer size={14} /> },
              { type: 'loop' as const, label: 'Loop', icon: <Repeat size={14} /> },
              { type: 'merge' as const, label: 'Merge', icon: <GitMerge size={14} /> },
              { type: 'condition' as const, label: 'Condition', icon: <GitBranch size={14} /> },
            ]).map((opt) => (
              <button
                key={opt.type}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs text-app-secondary transition-colors hover:bg-blue-500/15 hover:text-app-primary"
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

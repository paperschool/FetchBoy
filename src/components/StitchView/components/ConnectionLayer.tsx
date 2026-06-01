import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import { ConnectionLine } from './ConnectionLine';
import { useConnectionDrag } from './StitchConnectionDragContext';
import { getNodeOutputKeys, getNodeInputKeys, getPortLeftPercent } from '../utils/nodeOutputKeys';
import type { StitchNode, StitchConnection } from '@/types/stitch';

const NODE_WIDTH = 180;
const INPUT_SLOT_OFFSET_Y = 0;
const FALLBACK_HEIGHT = 82;

function measureNodeHeight(nodeId: string): number {
  const el = document.querySelector(`[data-node-id="${nodeId}"]`);
  return el ? (el as HTMLElement).offsetHeight : FALLBACK_HEIGHT;
}

function getOutputPortPosition(
  node: StitchNode,
  portKey: string,
  allKeys: string[],
): { x: number; y: number } {
  const leftPercent = getPortLeftPercent(node.type, portKey, allKeys) / 100;
  const nodeHeight = measureNodeHeight(node.id);
  return { x: node.positionX + NODE_WIDTH * leftPercent, y: node.positionY + nodeHeight };
}

function measureNodeWidth(nodeId: string): number {
  const el = document.querySelector(`[data-node-id="${nodeId}"]`);
  return el ? (el as HTMLElement).offsetWidth : NODE_WIDTH;
}

function getInputSlotPosition(node: StitchNode, targetSlot?: string | null): { x: number; y: number } {
  const inputKeys = getNodeInputKeys(node);
  if (targetSlot && inputKeys.length > 0 && inputKeys.includes(targetSlot)) {
    const leftPercent = getPortLeftPercent(node.type, targetSlot, inputKeys) / 100;
    return { x: node.positionX + NODE_WIDTH * leftPercent, y: node.positionY + INPUT_SLOT_OFFSET_Y };
  }
  const width = node.type === 'loop' ? measureNodeWidth(node.id) : NODE_WIDTH;
  return { x: node.positionX + width / 2, y: node.positionY + INPUT_SLOT_OFFSET_Y };
}

interface ConnectionLayerProps {
  onConnectionContextMenu?: (connId: string, x: number, y: number) => void;
}

export function ConnectionLayer({ onConnectionContextMenu }: ConnectionLayerProps = {}): React.ReactElement {
  const nodes = useStitchStore((s) => s.nodes);
  const connections = useStitchStore((s) => s.connections);
  const selectedConnectionId = useStitchStore((s) => s.selectedConnectionId);
  const selectConnection = useStitchStore((s) => s.selectConnection);
  const executionNodeOutputs = useStitchStore((s) => s.executionNodeOutputs);
  const executionCurrentNodeId = useStitchStore((s) => s.executionCurrentNodeId);
  const { drag } = useConnectionDrag();

  // Force recalculation after DOM paints (node heights not available during initial render)
  // Double-rAF ensures the browser has fully laid out and painted the nodes
  const [calibrated, setCalibrated] = useState(0);
  const calibrateRef = useRef<number | null>(null);
  useEffect(() => {
    const id1 = requestAnimationFrame(() => {
      calibrateRef.current = requestAnimationFrame(() => setCalibrated((c) => c + 1));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (calibrateRef.current) cancelAnimationFrame(calibrateRef.current);
    };
  }, [nodes, connections]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, StitchNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const handleClick = useCallback(
    (connId: string): void => { selectConnection(connId); },
    [selectConnection],
  );

  const handleContextMenu = useCallback(
    (connId: string, e: React.MouseEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      onConnectionContextMenu?.(connId, e.clientX, e.clientY);
    },
    [onConnectionContextMenu],
  );

  // Include nodes in deps so connection positions recalculate when node content/height changes
  const connectionLines = useMemo(() => {
    return connections.map((conn: StitchConnection) => {
      const sourceNode = nodeMap.get(conn.sourceNodeId);
      const targetNode = nodeMap.get(conn.targetNodeId);
      if (!sourceNode || !targetNode) return null;

      const sourceKeys = getNodeOutputKeys(sourceNode, connections, nodes);
      const isBroken = conn.sourceKey !== null && !sourceKeys.includes(conn.sourceKey);

      const from = conn.sourceKey
        ? getOutputPortPosition(sourceNode, conn.sourceKey, sourceKeys)
        : { x: sourceNode.positionX + measureNodeWidth(sourceNode.id) / 2, y: sourceNode.positionY + measureNodeHeight(sourceNode.id) };
      const to = getInputSlotPosition(targetNode, conn.targetSlot);

      const status = conn.id === selectedConnectionId
        ? 'selected' as const
        : isBroken
          ? 'broken' as const
          : 'active' as const;

      // Execution state for marching ants
      const sourceCompleted = conn.sourceNodeId in executionNodeOutputs;
      const targetIsRunning = executionCurrentNodeId === conn.targetNodeId;
      const targetCompleted = conn.targetNodeId in executionNodeOutputs;
      const execStatus: 'default' | 'active' | 'fading' =
        sourceCompleted && targetIsRunning ? 'active'
        : sourceCompleted && targetCompleted ? 'fading'
        : 'default';

      // Resolved input alias the consumer sees (e.g. `input.headers_2`).
      // Only show when the target uses the generic 'input' slot — explicit
      // slots like mapping-exit's status/headers/body/cookies are already
      // visible on the node itself.
      const targetInputKeys = getNodeInputKeys(targetNode);
      const targetUsesGenericInput = targetInputKeys.length === 0;
      const resolvedAlias = targetUsesGenericInput
        ? (conn.targetSlot && conn.targetSlot !== 'input' ? conn.targetSlot : conn.sourceKey)
        : null;

      return {
        id: conn.id,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        status,
        executionStatus: execStatus,
        isBroken,
        sourceKey: conn.sourceKey,
        alias: resolvedAlias,
      };
    }).filter(Boolean) as Array<{
      id: string; fromX: number; fromY: number; toX: number; toY: number;
      status: 'active' | 'selected' | 'broken'; executionStatus: 'default' | 'active' | 'fading';
      isBroken: boolean; sourceKey: string | null; alias: string | null;
    }>;
  }, [connections, nodeMap, nodes, selectedConnectionId, calibrated, executionNodeOutputs, executionCurrentNodeId]);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ overflow: 'visible' }}
      data-testid="connection-layer"
    >
      {connectionLines.map((line) => (
        <g key={line.id}>
          <ConnectionLine
            fromX={line.fromX}
            fromY={line.fromY}
            toX={line.toX}
            toY={line.toY}
            status={line.status}
            executionStatus={line.executionStatus}
            onClick={() => handleClick(line.id)}
            onContextMenu={(e) => handleContextMenu(line.id, e)}
          />
          {line.alias && (() => {
            const midX = (line.fromX + line.toX) / 2;
            const midY = (line.fromY + line.toY) / 2;
            // Approximate text width to size the backdrop pill (~5.5px per glyph at 9px font)
            const w = line.alias.length * 5.5 + 10;
            return (
              <g className="pointer-events-none select-none">
                <rect
                  x={midX - w / 2}
                  y={midY - 8}
                  width={w}
                  height={14}
                  rx={3}
                  ry={3}
                  fill="var(--app-main, #111)"
                  stroke="var(--app-border-subtle)"
                  strokeWidth={0.5}
                  opacity={0.9}
                />
                <text
                  x={midX}
                  y={midY + 2}
                  textAnchor="middle"
                  style={{ fontSize: '9px', fill: 'var(--app-text-muted)', fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {line.alias}
                </text>
              </g>
            );
          })()}
        </g>
      ))}

      {/* Preview wire during drag */}
      {drag && (
        <ConnectionLine
          fromX={drag.sourceX}
          fromY={drag.sourceY}
          toX={drag.cursorX}
          toY={drag.cursorY}
          status="preview"
        />
      )}
    </svg>
  );
}

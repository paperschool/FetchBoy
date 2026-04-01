import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import { ConnectionLine } from './ConnectionLine';
import { useConnectionDrag } from './StitchConnectionDragContext';
import { getNodeOutputKeys, getNodeInputKeys } from '../utils/nodeOutputKeys';
import type { StitchNode, StitchConnection } from '@/types/stitch';

const NODE_WIDTH = 180;
const INPUT_SLOT_OFFSET_Y = -1.5;
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
  const idx = allKeys.indexOf(portKey);
  const count = allKeys.length;
  const offset = count === 1 ? 0.5 : count === 0 ? 0.5 : idx / (count - 1);
  const leftPercent = (10 + offset * 80) / 100;
  const nodeHeight = measureNodeHeight(node.id);
  return { x: node.positionX + NODE_WIDTH * leftPercent, y: node.positionY + nodeHeight };
}

function measureNodeWidth(nodeId: string): number {
  const el = document.querySelector(`[data-node-id="${nodeId}"]`);
  return el ? (el as HTMLElement).offsetWidth : NODE_WIDTH;
}

function getInputSlotPosition(node: StitchNode, targetSlot?: string | null): { x: number; y: number } {
  const inputKeys = getNodeInputKeys(node);
  if (targetSlot && inputKeys.length > 0) {
    const idx = inputKeys.indexOf(targetSlot);
    if (idx >= 0) {
      const count = inputKeys.length;
      const offset = count === 1 ? 0.5 : idx / (count - 1);
      const leftPercent = (10 + offset * 80) / 100;
      return { x: node.positionX + NODE_WIDTH * leftPercent, y: node.positionY + INPUT_SLOT_OFFSET_Y };
    }
  }
  const width = node.type === 'loop' ? measureNodeWidth(node.id) : NODE_WIDTH;
  return { x: node.positionX + width / 2, y: node.positionY + INPUT_SLOT_OFFSET_Y };
}

export function ConnectionLayer(): React.ReactElement {
  const nodes = useStitchStore((s) => s.nodes);
  const connections = useStitchStore((s) => s.connections);
  const removeConnection = useStitchStore((s) => s.removeConnection);
  const selectedConnectionId = useStitchStore((s) => s.selectedConnectionId);
  const selectConnection = useStitchStore((s) => s.selectConnection);
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
      removeConnection(connId).catch(() => {});
    },
    [removeConnection],
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

      return {
        id: conn.id,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        status,
        isBroken,
        sourceKey: conn.sourceKey,
      };
    }).filter(Boolean) as Array<{
      id: string; fromX: number; fromY: number; toX: number; toY: number;
      status: 'active' | 'selected' | 'broken'; isBroken: boolean; sourceKey: string | null;
    }>;
  }, [connections, nodeMap, nodes, selectedConnectionId, calibrated]);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ overflow: 'visible' }}
      data-testid="connection-layer"
    >
      {connectionLines.map((line) => (
        <ConnectionLine
          key={line.id}
          fromX={line.fromX}
          fromY={line.fromY}
          toX={line.toX}
          toY={line.toY}
          status={line.status}
          onClick={() => handleClick(line.id)}
          onContextMenu={(e) => handleContextMenu(line.id, e)}
        />
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

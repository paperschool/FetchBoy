import { useMemo, useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import { ConnectionLine } from './ConnectionLine';
import { useConnectionDrag } from './StitchConnectionDragContext';
import { getNodeOutputKeys } from '../utils/nodeOutputKeys';
import type { StitchNode, StitchConnection } from '@/types/stitch';

const NODE_WIDTH = 180;
const INPUT_SLOT_OFFSET_Y = -1.5;

function getOutputPortPosition(
  node: StitchNode,
  portKey: string,
  allKeys: string[],
): { x: number; y: number } {
  const idx = allKeys.indexOf(portKey);
  const count = allKeys.length;
  const offset = count === 1 ? 0.5 : count === 0 ? 0.5 : idx / (count - 1);
  const leftPercent = (10 + offset * 80) / 100;
  // Node min-height ~70, but actual height varies. Use ~70 as estimate.
  return { x: node.positionX + NODE_WIDTH * leftPercent, y: node.positionY + 70 };
}

function getInputSlotPosition(node: StitchNode): { x: number; y: number } {
  return { x: node.positionX + NODE_WIDTH / 2, y: node.positionY + INPUT_SLOT_OFFSET_Y };
}

export function ConnectionLayer(): React.ReactElement {
  const nodes = useStitchStore((s) => s.nodes);
  const connections = useStitchStore((s) => s.connections);
  const removeConnection = useStitchStore((s) => s.removeConnection);
  const selectedConnectionId = useStitchStore((s) => s.selectedConnectionId);
  const selectConnection = useStitchStore((s) => s.selectConnection);
  const { drag } = useConnectionDrag();

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

  const connectionLines = useMemo(() => {
    return connections.map((conn: StitchConnection) => {
      const sourceNode = nodeMap.get(conn.sourceNodeId);
      const targetNode = nodeMap.get(conn.targetNodeId);
      if (!sourceNode || !targetNode) return null;

      const sourceKeys = getNodeOutputKeys(sourceNode);
      const isBroken = conn.sourceKey !== null && !sourceKeys.includes(conn.sourceKey);

      const from = conn.sourceKey
        ? getOutputPortPosition(sourceNode, conn.sourceKey, sourceKeys)
        : { x: sourceNode.positionX + NODE_WIDTH / 2, y: sourceNode.positionY + 70 };
      const to = getInputSlotPosition(targetNode);

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
  }, [connections, nodeMap, selectedConnectionId]);

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

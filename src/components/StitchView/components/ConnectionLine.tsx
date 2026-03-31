import React from 'react';

type ConnectionStatus = 'active' | 'preview' | 'broken' | 'selected';

interface ConnectionLineProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  status: ConnectionStatus;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function getStrokeStyle(status: ConnectionStatus): { stroke: string; strokeDasharray?: string; opacity: number } {
  switch (status) {
    case 'active': return { stroke: 'var(--app-text-muted)', opacity: 0.6 };
    case 'preview': return { stroke: '#3b82f6', opacity: 0.5 };
    case 'selected': return { stroke: '#3b82f6', opacity: 1 };
    case 'broken': return { stroke: '#ef4444', strokeDasharray: '6 3', opacity: 0.7 };
  }
}

export const ConnectionLine = React.memo(function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  status,
  onClick,
  onContextMenu,
}: ConnectionLineProps): React.ReactElement {
  const dy = Math.abs(toY - fromY);
  const cpOffset = Math.max(30, dy * 0.5);
  const d = `M ${fromX},${fromY} C ${fromX},${fromY + cpOffset} ${toX},${toY - cpOffset} ${toX},${toY}`;

  const style = getStrokeStyle(status);

  return (
    <g data-testid="connection-line">
      {/* Wide invisible hit area for clicking */}
      {onClick && (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
          onClick={onClick}
          onContextMenu={onContextMenu}
        />
      )}
      {/* Visible line */}
      <path
        d={d}
        fill="none"
        stroke={style.stroke}
        strokeWidth={status === 'selected' ? 2.5 : 1.5}
        strokeDasharray={style.strokeDasharray}
        opacity={style.opacity}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
});

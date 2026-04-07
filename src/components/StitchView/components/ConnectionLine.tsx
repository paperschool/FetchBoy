import React from 'react';

type ConnectionStatus = 'active' | 'preview' | 'broken' | 'selected';
type ExecutionStatus = 'default' | 'active' | 'fading';

interface ConnectionLineProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  status: ConnectionStatus;
  executionStatus?: ExecutionStatus;
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
  fromX, fromY, toX, toY, status, executionStatus = 'default', onClick, onContextMenu,
}: ConnectionLineProps): React.ReactElement {
  const dy = Math.abs(toY - fromY);
  const cpOffset = Math.max(30, dy * 0.5);
  const d = `M ${fromX},${fromY} C ${fromX},${fromY + cpOffset} ${toX},${toY - cpOffset} ${toX},${toY}`;

  const style = getStrokeStyle(status);

  // Execution state overrides
  const execClass = executionStatus === 'active' ? 'stitch-connection-active'
    : executionStatus === 'fading' ? 'stitch-connection-fading' : undefined;
  const execStroke = executionStatus === 'active' ? 'rgb(74, 222, 128)' : undefined;

  return (
    <g data-testid="connection-line">
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
      <path
        d={d}
        fill="none"
        stroke={execStroke ?? style.stroke}
        strokeWidth={executionStatus !== 'default' ? 3 : (status === 'selected' ? 2.5 : 1.5)}
        strokeDasharray={executionStatus !== 'default' ? undefined : style.strokeDasharray}
        opacity={style.opacity}
        className={execClass}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
});

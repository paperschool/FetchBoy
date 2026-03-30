import { useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { useCanvasTransform } from './StitchCanvas.hooks';
import { StitchNode } from './StitchNode';
import { AddNodeMenu } from './AddNodeMenu';
import type { StitchNodeType } from '@/types/stitch';
import { DEFAULT_JSON_OBJECT_CONFIG } from '@/types/stitch';

export function StitchCanvas(): React.ReactElement {
  const nodes = useStitchStore((s) => s.nodes);
  const selectedNodeId = useStitchStore((s) => s.selectedNodeId);
  const selectNode = useStitchStore((s) => s.selectNode);
  const addNode = useStitchStore((s) => s.addNode);
  const updateNode = useStitchStore((s) => s.updateNode);
  const removeNode = useStitchStore((s) => s.removeNode);
  const activeChainId = useStitchStore((s) => s.activeChainId);

  const { transform, onWheel, onPointerDown, onPointerMove, onPointerUp, zoomIn, zoomOut, zoomReset } =
    useCanvasTransform();

  const handleCanvasClick = useCallback((): void => {
    selectNode(null);
  }, [selectNode]);

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
      const config = type === 'json-object' ? { ...DEFAULT_JSON_OBJECT_CONFIG } : {};
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

  const zoomPercent = Math.round(transform.zoom * 100);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center gap-2 border-b border-app-subtle bg-app-sidebar px-3 py-1.5"
        data-stitch-toolbar
      >
        <AddNodeMenu onAddNode={handleAddNode} />
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
          onClick={zoomReset}
          title="Reset zoom"
        >
          <Maximize size={14} />
        </button>
      </div>

      {/* Canvas area */}
      <div
        className="relative flex-1 cursor-grab overflow-hidden bg-app-main active:cursor-grabbing"
        data-testid="stitch-canvas"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={handleCanvasClick}
      >
        <div
          style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            inset: 0,
          }}
        >
          {nodes.map((node) => (
            <StitchNode
              key={node.id}
              node={node}
              selected={node.id === selectedNodeId}
              zoom={transform.zoom}
              panX={transform.panX}
              panY={transform.panY}
              onSelect={selectNode}
              onUpdatePosition={handleUpdatePosition}
              onUpdateLabel={handleUpdateLabel}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-app-muted">Empty canvas</p>
              <p className="mt-1 text-xs text-app-muted">
                Use "Add Node" to start building your chain
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

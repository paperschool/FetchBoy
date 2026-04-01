import { useState, useCallback, useRef, useEffect, type PointerEvent } from 'react';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

export interface CanvasTransform {
  panX: number;
  panY: number;
  zoom: number;
}

interface PanState {
  isPanning: boolean;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
}

export interface UseCanvasTransformReturn {
  transform: CanvasTransform;
  canvasRef: React.RefObject<HTMLDivElement>;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  frameAll: (nodes: Array<{ positionX: number; positionY: number }>) => void;
}

export function useCanvasTransform(): UseCanvasTransformReturn {
  const [transform, setTransform] = useState<CanvasTransform>({
    panX: 0,
    panY: 0,
    zoom: 1,
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  const panRef = useRef<PanState>({
    isPanning: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // Imperative wheel listener with { passive: false } so preventDefault() works
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent): void => {
      e.preventDefault();
      setTransform((prev) => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom + delta));
        return { ...prev, zoom: newZoom };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Use a ref for the latest transform to avoid stale closures and unnecessary re-creations
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const onPointerDown = useCallback((e: PointerEvent): void => {
    // Only pan on primary button and when clicking empty canvas
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-stitch-node]')) return;
    if ((e.target as HTMLElement).closest('[data-stitch-toolbar]')) return;

    panRef.current = {
      isPanning: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: transformRef.current.panX,
      startPanY: transformRef.current.panY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent): void => {
    if (!panRef.current.isPanning) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    setTransform((prev) => ({
      ...prev,
      panX: panRef.current.startPanX + dx,
      panY: panRef.current.startPanY + dy,
    }));
  }, []);

  const onPointerUp = useCallback((): void => {
    panRef.current.isPanning = false;
  }, []);

  const zoomIn = useCallback((): void => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.min(MAX_ZOOM, prev.zoom + ZOOM_STEP),
    }));
  }, []);

  const zoomOut = useCallback((): void => {
    setTransform((prev) => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, prev.zoom - ZOOM_STEP),
    }));
  }, []);

  const zoomReset = useCallback((): void => {
    setTransform({ panX: 0, panY: 0, zoom: 1 });
  }, []);

  const NODE_W = 180;
  const NODE_H = 90;
  const PADDING = 60;

  const frameAll = useCallback((nodes: Array<{ positionX: number; positionY: number }>): void => {
    if (nodes.length === 0) {
      setTransform({ panX: 0, panY: 0, zoom: 1 });
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    const viewW = rect?.width ?? 800;
    const viewH = rect?.height ?? 600;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.positionX);
      minY = Math.min(minY, n.positionY);
      maxX = Math.max(maxX, n.positionX + NODE_W);
      maxY = Math.max(maxY, n.positionY + NODE_H);
    }

    const contentW = maxX - minX + PADDING * 2;
    const contentH = maxY - minY + PADDING * 2;

    const zoom = Math.min(
      Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewW / contentW, viewH / contentH)),
      1.0, // don't zoom in past 100%
    );

    const panX = (viewW - contentW * zoom) / 2 - (minX - PADDING) * zoom;
    const panY = (viewH - contentH * zoom) / 2 - (minY - PADDING) * zoom;

    setTransform({ panX, panY, zoom });
  }, [canvasRef]);

  return { transform, canvasRef, onPointerDown, onPointerMove, onPointerUp, zoomIn, zoomOut, zoomReset, frameAll };
}

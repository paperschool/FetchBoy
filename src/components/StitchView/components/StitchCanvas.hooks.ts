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

  return { transform, canvasRef, onPointerDown, onPointerMove, onPointerUp, zoomIn, zoomOut, zoomReset };
}

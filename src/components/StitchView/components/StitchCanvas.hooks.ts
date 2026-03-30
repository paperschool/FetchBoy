import { useState, useCallback, useRef, type WheelEvent, type PointerEvent } from 'react';

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
  onWheel: (e: WheelEvent) => void;
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

  const panRef = useRef<PanState>({
    isPanning: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  const onWheel = useCallback((e: WheelEvent): void => {
    e.preventDefault();
    setTransform((prev) => {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom + delta));
      return { ...prev, zoom: newZoom };
    });
  }, []);

  const onPointerDown = useCallback((e: PointerEvent): void => {
    // Only pan on primary button and when clicking empty canvas
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-stitch-node]')) return;
    if ((e.target as HTMLElement).closest('[data-stitch-toolbar]')) return;

    panRef.current = {
      isPanning: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: transform.panX,
      startPanY: transform.panY,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [transform.panX, transform.panY]);

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

  return { transform, onWheel, onPointerDown, onPointerMove, onPointerUp, zoomIn, zoomOut, zoomReset };
}

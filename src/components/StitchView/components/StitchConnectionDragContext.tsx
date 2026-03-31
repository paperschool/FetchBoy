import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

interface DragState {
  isDragging: boolean;
  sourceNodeId: string;
  sourceKey: string;
  sourceX: number;
  sourceY: number;
  cursorX: number;
  cursorY: number;
}

interface ConnectionDragContextValue {
  drag: DragState | null;
  startDrag: (sourceNodeId: string, sourceKey: string, sourceX: number, sourceY: number) => void;
  updateCursor: (x: number, y: number) => void;
  endDrag: () => void;
  /** Populated briefly after a drag ends without connecting. Consumed once by reading and clearing. */
  consumeDroppedDrag: () => DragState | null;
}

const ConnectionDragContext = createContext<ConnectionDragContextValue | null>(null);

export function useConnectionDrag(): ConnectionDragContextValue {
  const ctx = useContext(ConnectionDragContext);
  if (!ctx) throw new Error('useConnectionDrag must be used within StitchConnectionDragProvider');
  return ctx;
}

export function StitchConnectionDragProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [drag, setDrag] = useState<DragState | null>(null);
  const droppedRef = useRef<DragState | null>(null);

  const startDrag = useCallback((sourceNodeId: string, sourceKey: string, sourceX: number, sourceY: number): void => {
    droppedRef.current = null;
    setDrag({ isDragging: true, sourceNodeId, sourceKey, sourceX, sourceY, cursorX: sourceX, cursorY: sourceY });
  }, []);

  const updateCursor = useCallback((x: number, y: number): void => {
    setDrag((prev) => prev ? { ...prev, cursorX: x, cursorY: y } : null);
  }, []);

  const endDrag = useCallback((): void => {
    setDrag((prev) => {
      droppedRef.current = prev;
      return null;
    });
  }, []);

  const consumeDroppedDrag = useCallback((): DragState | null => {
    const d = droppedRef.current;
    droppedRef.current = null;
    return d;
  }, []);

  return (
    <ConnectionDragContext.Provider value={{ drag, startDrag, updateCursor, endDrag, consumeDroppedDrag }}>
      {children}
    </ConnectionDragContext.Provider>
  );
}

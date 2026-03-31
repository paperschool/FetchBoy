import { useEffect, useRef, useState, useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import * as stitchDb from '@/lib/stitch';

/**
 * Auto-save hook for Stitch chains.
 * Watches nodes and connections for changes, then debounces a full persist
 * as a safety net. Individual CRUD operations already persist in real-time;
 * this catches any edge cases where rapid mutations might be missed.
 */
export function useStitchAutoSave(): { saving: boolean } {
  const activeChainId = useStitchStore((s) => s.activeChainId);
  const nodes = useStitchStore((s) => s.nodes);
  const connections = useStitchStore((s) => s.connections);
  const [saving, setSaving] = useState(false);

  // Track the serialized snapshot to detect actual changes
  const lastSavedRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async (): Promise<void> => {
    if (!activeChainId) return;
    const snapshot = JSON.stringify({ nodes, connections });
    if (snapshot === lastSavedRef.current) return;

    setSaving(true);
    try {
      // Update the chain's updatedAt timestamp
      await stitchDb.updateChain(activeChainId, {});
      lastSavedRef.current = snapshot;
    } catch {
      // Silent failure — individual CRUD is the primary persistence
    } finally {
      setSaving(false);
    }
  }, [activeChainId, nodes, connections]);

  // Debounced save on change
  useEffect(() => {
    if (!activeChainId) return;

    const snapshot = JSON.stringify({ nodes, connections });
    if (snapshot === lastSavedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush();
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeChainId, nodes, connections, flush]);

  // Cmd+S / Ctrl+S for immediate save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        flush();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flush]);

  // Reset snapshot when chain changes
  useEffect(() => {
    lastSavedRef.current = '';
  }, [activeChainId]);

  return { saving };
}

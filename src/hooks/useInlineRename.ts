import { useState, useRef, useCallback, useEffect } from 'react';
import type { KeyboardEvent } from 'react';

interface UseInlineRenameReturn {
  editingId: string | null;
  editValue: string;
  editRef: React.MutableRefObject<HTMLInputElement | null>;
  startEditing: (id: string, currentName: string) => void;
  setEditValue: React.Dispatch<React.SetStateAction<string>>;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  handleBlur: () => void;
  cancelEditing: () => void;
}

/**
 * Shared inline rename hook. Manages editing state, ref focus,
 * Enter/Escape key handling, and blur-to-confirm.
 */
export function useInlineRename(
  onConfirm: (id: string, newName: string) => void,
): UseInlineRenameReturn {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement | null>(null);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  // Auto-focus and select when editing starts
  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  const startEditing = useCallback((id: string, currentName: string): void => {
    setEditingId(id);
    setEditValue(currentName);
  }, []);

  const cancelEditing = useCallback((): void => {
    setEditingId(null);
  }, []);

  const confirm = useCallback((): void => {
    if (editingId) {
      onConfirmRef.current(editingId, editValue);
      setEditingId(null);
    }
  }, [editingId, editValue]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') cancelEditing();
  }, [confirm, cancelEditing]);

  const handleBlur = useCallback((): void => {
    confirm();
  }, [confirm]);

  return {
    editingId, editValue, editRef,
    startEditing, setEditValue, handleKeyDown, handleBlur, cancelEditing,
  };
}

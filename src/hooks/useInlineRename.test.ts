import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useInlineRename } from './useInlineRename';
import type { KeyboardEvent } from 'react';

function makeKeyEvent(key: string): KeyboardEvent<HTMLInputElement> {
  return { key } as KeyboardEvent<HTMLInputElement>;
}

describe('useInlineRename', () => {
  it('starts with no editing state', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useInlineRename(onConfirm));

    expect(result.current.editingId).toBeNull();
    expect(result.current.editValue).toBe('');
  });

  it('startEditing sets id and value', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useInlineRename(onConfirm));

    act(() => { result.current.startEditing('item-1', 'Original Name'); });
    expect(result.current.editingId).toBe('item-1');
    expect(result.current.editValue).toBe('Original Name');
  });

  it('handleBlur confirms and clears editing', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useInlineRename(onConfirm));

    act(() => { result.current.startEditing('item-1', 'Name'); });
    act(() => { result.current.setEditValue('New Name'); });
    act(() => { result.current.handleBlur(); });

    expect(onConfirm).toHaveBeenCalledWith('item-1', 'New Name');
    expect(result.current.editingId).toBeNull();
  });

  it('Enter key confirms', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useInlineRename(onConfirm));

    act(() => { result.current.startEditing('item-1', 'Name'); });
    act(() => { result.current.setEditValue('Updated'); });
    act(() => { result.current.handleKeyDown(makeKeyEvent('Enter')); });

    expect(onConfirm).toHaveBeenCalledWith('item-1', 'Updated');
    expect(result.current.editingId).toBeNull();
  });

  it('Escape key cancels without confirming', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useInlineRename(onConfirm));

    act(() => { result.current.startEditing('item-1', 'Name'); });
    act(() => { result.current.setEditValue('Changed'); });
    act(() => { result.current.handleKeyDown(makeKeyEvent('Escape')); });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(result.current.editingId).toBeNull();
  });

  it('cancelEditing clears state without confirm', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useInlineRename(onConfirm));

    act(() => { result.current.startEditing('item-1', 'Name'); });
    act(() => { result.current.cancelEditing(); });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(result.current.editingId).toBeNull();
  });

  it('does not call confirm when no editing active', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useInlineRename(onConfirm));

    act(() => { result.current.handleBlur(); });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('setEditValue updates the value', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useInlineRename(onConfirm));

    act(() => { result.current.startEditing('item-1', 'Initial'); });
    act(() => { result.current.setEditValue('Modified'); });
    expect(result.current.editValue).toBe('Modified');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { KEYBOARD_SHORTCUTS, getShortcutDisplay } from '@/lib/keyboardShortcuts';

describe('KeyboardShortcutsModal', () => {
  it('renders modal when open', () => {
    render(<KeyboardShortcutsModal open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('keyboard-shortcuts-modal')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<KeyboardShortcutsModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('keyboard-shortcuts-modal')).not.toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on click outside (overlay)', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('keyboard-shortcuts-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close on click inside modal', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('keyboard-shortcuts-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on close button click', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('groups shortcuts by category', () => {
    render(<KeyboardShortcutsModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Request')).toBeInTheDocument();
    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });

  it('displays all shortcuts from constants', () => {
    render(<KeyboardShortcutsModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Send Request')).toBeInTheDocument();
    expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument();
    expect(screen.getByText('New Tab')).toBeInTheDocument();
    expect(screen.getByText('Close Tab')).toBeInTheDocument();
    expect(screen.getByText('Next Tab')).toBeInTheDocument();
  });

  it('does not trigger Escape handler when closed', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal open={false} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('KEYBOARD_SHORTCUTS constants', () => {
  it('all shortcuts have required fields', () => {
    KEYBOARD_SHORTCUTS.forEach((shortcut) => {
      expect(shortcut.id).toBeDefined();
      expect(shortcut.displayName).toBeDefined();
      expect(['general', 'request', 'tabs']).toContain(shortcut.category);
      expect(shortcut.macKeys).toBeDefined();
      expect(shortcut.windowsKeys).toBeDefined();
    });
  });

  it('getShortcutDisplay returns macKeys when isMac is true', () => {
    const sendRequest = KEYBOARD_SHORTCUTS.find((s) => s.id === 'send-request')!;
    expect(getShortcutDisplay(true, sendRequest)).toBe('⌘+Enter');
  });

  it('getShortcutDisplay returns windowsKeys when isMac is false', () => {
    const sendRequest = KEYBOARD_SHORTCUTS.find((s) => s.id === 'send-request')!;
    expect(getShortcutDisplay(false, sendRequest)).toBe('Ctrl+Enter');
  });
});

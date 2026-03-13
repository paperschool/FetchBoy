import { useEffect } from 'react';
import { X } from 'lucide-react';
import { KEYBOARD_SHORTCUTS, KeyboardShortcut } from '@/lib/keyboardShortcuts';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const categoryLabels: Record<string, string> = {
  general: 'General',
  request: 'Request',
  tabs: 'Tabs',
};

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const grouped = KEYBOARD_SHORTCUTS.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, KeyboardShortcut[]>,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      data-testid="keyboard-shortcuts-overlay"
    >
      <div
        className="bg-app-main border border-app-subtle rounded-lg p-6 w-[420px] shadow-xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="keyboard-shortcuts-modal"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-app-primary font-semibold text-lg">Keyboard Shortcuts</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-app-primary opacity-60 hover:opacity-100"
          >
            <X size={20} />
          </button>
        </div>

        {Object.entries(grouped).map(([category, shortcuts]) => (
          <div key={category} className="mb-6 last:mb-0">
            <h3 className="text-app-secondary text-sm font-medium mb-3 uppercase tracking-wide">
              {categoryLabels[category]}
            </h3>
            <dl className="space-y-2">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.id} className="flex justify-between items-center">
                  <dt className="text-app-primary text-sm">{shortcut.displayName}</dt>
                  <dd className="text-app-muted font-mono text-xs bg-app-subtle px-2 py-1 rounded">
                    {shortcut.macKeys} / {shortcut.windowsKeys}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}

        <div className="mt-6 pt-4 border-t border-app-subtle text-center">
          <p className="text-app-muted text-xs">
            Press{' '}
            <kbd className="bg-app-subtle px-1.5 py-0.5 rounded text-app-primary">?</kbd> anytime
            to show this overlay
          </p>
        </div>
      </div>
    </div>
  );
}
